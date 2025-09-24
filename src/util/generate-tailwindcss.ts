import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { join } from 'node:path';

const extractTailwindClasses = (htmlContent: string): string[] => {
  // Regex to match class attributes
  const classRegex = /class="([^"]+)"/g;
  const classes = new Set<string>();

  let match;
  while ((match = classRegex.exec(htmlContent)) !== null) {
    const classString = match[1];
    // Split classes and add to set
    classString.split(/\s+/).forEach(cls => {
      if (cls.trim()) {
        classes.add(cls.trim());
      }
    });
  }

  return Array.from(classes);
};

const runtimeTracker = new Set<string>();

export const generateTailwindCSS = async (htmlContent: string, filename: string) => {
  if (!filename.endsWith('.css')) {
    filename += '.css';
  }
  const inPath = join(import.meta.dir, '..', 'templates', 'tailwind', filename);
  const outPath = inPath.replace('.css', '_out.css');

  const needsConversion = !runtimeTracker.has(filename);
  if (needsConversion) {
    const classes = extractTailwindClasses(htmlContent);
    const css = `@import "tailwindcss"; @source inline("${classes.join(',')}")`;
    await Bun.write(inPath, css);
    const conversion = await Bun.$`bunx @tailwindcss/cli -m -i ${inPath} -o ${outPath}`.text();
    runtimeTracker.add(filename);
  }

  const result = await Bun.file(outPath).text();
  return result;
};
