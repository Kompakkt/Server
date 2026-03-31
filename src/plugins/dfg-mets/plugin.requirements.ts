import { ObjectId } from 'mongodb';
import { log } from 'src/logger';
import { apiKeyCollection } from 'src/mongo';

export default async () => {
  const apiKey = Bun.env['CONFIGURATION_EXTENSION_DFG_METS_API_KEY'];
  if (!apiKey) return false;

  const existing = await apiKeyCollection.findOne({ key: apiKey });
  if (!existing) {
    log(`Creating new DFG METS API key`);
    const result = await apiKeyCollection
      .insertOne({
        _id: new ObjectId(),
        description: 'DFG METS integration',
        key: apiKey,
        issueDate: Date.now(),
        routes: ['/dfg-mets-api/'],
      })
      .then(result => {
        log(`Created DFG METS API key with Id: ${result.insertedId}`);
        return true;
      });
    if (!result) {
      log(`Failed to create DFG METS API key`);
      return false;
    }
    return true;
  }

  log(`DFG METS API key already exists`);

  return true;
};
