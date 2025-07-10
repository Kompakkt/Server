import { mkdtemp, rmdir, rename, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { entityCollection } from 'src/mongo';
import { ObjectId } from 'mongodb';
import { info } from 'src/logger';
import puppeteer from 'puppeteer-core';
import { setTimeout } from 'node:timers/promises';
import Elysia from 'elysia';
import { RootDirectory } from 'src/environment';
import { Configuration } from 'src/configuration';

export const generateVideoPreview = async (entityId: string): Promise<string> => {
  const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
  if (!entity) throw new Error('Entity not found');

  const tmpDir = await mkdtemp(join(tmpdir(), 'bun-'));
  const { position, target } = entity.settings.cameraPositionInitial;
  const pluginExtension = '.' + (entity.processed.raw.split('.').pop() || 'babylon');

  const mediaType =
    {
      model: 'entity',
      cloud: 'entity',
      splat: 'entity',
    }[entity.mediaType] ?? entity.mediaType;

  info('Starting server');
  const renderServer = new Elysia({ name: 'RenderServer' })
    .get('/', ({ set }) => {
      set.headers['content-type'] = 'text/html';
      info('Got request');
      return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Video Preview</title>
      <style>
          html, body {
            overflow: hidden; width: 100%; height: 100%;
            margin: 0; padding: 0;
          }
          #renderCanvas {
            width: 100%; height: 100%;
            touch-action: none;
          }
      </style>
      <script src="https://cdn.babylonjs.com/babylon.js"></script>
      <script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
    </head>
    <body>
      <canvas id="renderCanvas"></canvas>
    </body>
    <script>
    try {
      const canvas = document.getElementById('renderCanvas');
      const engine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(engine);

      scene.createDefaultEnvironment();
      scene.environmentIntensity = 1;

      scene.imageProcessingConfiguration.exposure = 1;
      scene.imageProcessingConfiguration.contrast = 1;
      scene.imageProcessingConfiguration.toneMappingEnabled = true;
      scene.imageProcessingConfiguration.toneMappingType =
        BABYLON.ImageProcessingConfiguration.TONEMAPPING_STANDARD;

      scene.meshes.find(m => m.name === 'BackgroundPlane')?.dispose();

      // TODO: Check how to set transparent background
      // scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

      const camera = new BABYLON.ArcRotateCamera("arcRotateCamera",
          ${position.x}, ${position.y}, ${position.z},
          new BABYLON.Vector3(${target.x}, ${target.y}, ${target.z}),
          scene
      );
      camera.attachControl(canvas, true);

      new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(0, -1, 0), scene);
      new BABYLON.HemisphericLight("HemiLightUp", new BABYLON.Vector3(0, 1, 0), scene);
      new BABYLON.HemisphericLight("HemiLightDown", new BABYLON.Vector3(0, -1, 0), scene);

      engine.runRenderLoop(function () {
        scene.render();
      });

      window.addEventListener("resize", function () {
        engine.resize();
      });

      const originalAlpha = camera.alpha;

      window.rotateCameraToAngle = function(angleDegrees) {
        const angleRadians = BABYLON.Tools.ToRadians(angleDegrees);
        camera.alpha = originalAlpha + angleRadians;
        scene.render();
        console.log('Camera rotated to angle:', angleDegrees);
      };

      window.screenshotReady = function() {
        console.log('Screenshot ready');
      };

      const url = 'http://localhost:3030/server/${entity.processed.raw}';
      console.log('Loading mesh from:', url)

      const pluginExtension = '${pluginExtension}';
      console.log('with extension:', pluginExtension);

      BABYLON.ImportMeshAsync(url, scene, {
        pluginExtension,
        onProgress: event => {
          console.log('Loading progress:', event.loaded, '/', event.total);
        }
      }).then(result => {
        // Calculate absolute center of meshes recursively
        const meshes = result.meshes.flatMap((mesh) => {
          return [mesh].concat(mesh.getChildMeshes(false));
        });
        const absoluteCenter = meshes.reduce((acc, mesh) => {
          const center = mesh.getBoundingInfo().boundingBox.centerWorld;
          acc.x += center.x;
          acc.y += center.y;
          acc.z += center.z;
          return acc;
        }, { x: 0, y: 0, z: 0 });

        absoluteCenter.x /= meshes.length;
        absoluteCenter.y /= meshes.length;
        absoluteCenter.z /= meshes.length;

        camera.setTarget(new BABYLON.Vector3(absoluteCenter.x, absoluteCenter.y, absoluteCenter.z));

        console.log('Mesh loaded successfully');
      })
    } catch (error) {
      console.error('Error initializing Babylon.js scene:', error);
    }
    </script>
    </html>`;
    })
    .listen(3001);

  info('Opening puppeteer');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    defaultViewport: { width: 480, height: 270 },
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--no-crashpad',
      '--enable-unsafe-swiftshader',
    ],
  });

  try {
    info('Opening page');
    const page = await browser.newPage();

    const modelLoadedPromise = new Promise<boolean>(resolve => {
      page.on('console', msg => {
        const text = msg.text();
        info('Console message: ' + text);
        if (text.includes('Mesh loaded successfully')) {
          info('Mesh loaded successfully, proceeding with screenshot');
          resolve(true);
        }
        if (text.includes('Error:')) {
          info('Error in console: ' + text);
          resolve(false);
        }
      });
    });

    info('Waiting for page');
    await page.goto(`http://localhost:3001/`);

    const modelLoadedResult = await modelLoadedPromise;
    if (!modelLoadedResult) {
      throw new Error('Failed to load model');
    }

    info('Creating screenshot');
    const angles = [0, 90, 75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75, -90];
    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i];
      info(`Taking screenshot ${i + 1}/${angles.length} at angle: ${angle} degrees`);

      const startTime = process.hrtime();
      // Rotate camera to the desired angle
      await page.evaluate(angleDegrees => {
        (window as any).rotateCameraToAngle(angleDegrees);
      }, angle);

      // Wait a bit for the scene to stabilize
      await setTimeout(100);

      // Take screenshot
      const screenshot = await page.screenshot({ encoding: 'base64' });
      const elapsedTime = process.hrtime(startTime);

      // If screenshotting takes too long, abort for this model
      if (elapsedTime[0] > 10) {
        info(`Screenshotting ${entityId} took too long, aborting`);
        throw new Error('Screenshotting took too long, aborting');
      }

      const imageBuffer = Buffer.from(screenshot, 'base64');
      const filename = `${tmpDir}/frame_${i.toString().padStart(4, '0')}.png`;
      await Bun.write(filename, imageBuffer);
      info(`Screenshot ${i + 1} completed`);
    }

    info('All screenshots taken, starting video encoding');
    await Bun.$`ffmpeg -y -framerate ${angles.length} -i ${tmpDir}/frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -crf 10 -b:v 0 -g 1 ${tmpDir}/${entityId}.webm`;

    const previewPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${mediaType}/`;
    await mkdir(previewPath, { recursive: true });
    await copyFile(`${tmpDir}/${entityId}.webm`, `${previewPath}${entityId}.webm`);
  } catch (error) {
    info(`Error during video preview generation: ${error}`);
    throw new Error(`Failed to generate video preview: ${error}`);
  } finally {
    await browser.close();
    await renderServer.stop();
    await rmdir(tmpDir, { recursive: true });
  }

  return `/${Configuration.Uploads.UploadDirectory}/previews/${mediaType}/${entityId}.webm`;
};
