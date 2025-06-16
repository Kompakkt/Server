import { ObjectId } from 'mongodb';
import { log } from 'src/logger';
import { apiKeyCollection } from 'src/mongo';

export default async () => {
  const apiKey = Bun.env['CONFIGURATION_EXTENSION_COLOGNECAVE_API_KEY'];
  if (!apiKey) return false;

  const existing = await apiKeyCollection.findOne({ key: apiKey });
  if (!existing) {
    log(`Creating new CologneCave API key`);
    const result = await apiKeyCollection
      .insertOne({
        _id: new ObjectId(),
        description: 'Cologne Cave integration',
        key: apiKey,
        issueDate: Date.now(),
        routes: ['/cologne-cave-api/'],
      })
      .then(result => {
        log(`Created CologneCave API key with Id: ${result.insertedId}`);
        return true;
      });
    if (!result) {
      log(`Failed to create CologneCave API key`);
      return false;
    }
    return true;
  }

  log(`CologneCave API key already exists`);

  return true;
};
