import { ObjectId } from 'mongodb';
import type { IEntity } from 'src/common';
import { info, warn } from 'src/logger';
import { entityCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { generateVideoPreview } from 'src/util/generate-entity-preview-video';

const processEntities = async (entities: ServerDocument<IEntity>[]): Promise<void> => {
  for (const entity of entities) {
    try {
      info(`Generating preview video for ${entity._id}`);
      const previewPath = await generateVideoPreview(entity._id.toString());
      await entityCollection.updateOne(
        { _id: new ObjectId(entity._id) },
        { $set: { 'settings.previewVideo': previewPath } },
      );
    } catch (error) {
      warn(`Failed generating preview video for entity ${entity._id}: ${error}`);
    }
  }
};

export const ensureEntityPreviewVideos = async (): Promise<void> => {
  const entities = await entityCollection
    .find({ 'settings.previewVideo': { $exists: false } })
    .toArray();
  processEntities(entities).catch(error => {
    warn(`Failed ensuring entity preview videos: ${error}`);
  });
};
