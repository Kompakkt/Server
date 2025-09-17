import { err, log } from 'src/logger';
import { compilationCollection, entityCollection, profileCollection } from 'src/mongo';

const callback = async () => {
  const collections = [entityCollection, compilationCollection, profileCollection];
  try {
    for (const collection of collections) {
      await collection.updateMany({ __hits: { $gt: 0 } }, { $inc: { __hits: -1 } });
    }
  } catch (error) {
    err(`Failed decreasing popularity: ${error}`);
  }
};

export const decreatePopularityTimer = async () => {
  // Start a timer that runs every hour on the hour
  const now = new Date();
  const delay =
    (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
  setTimeout(() => {
    callback();
    setInterval(() => callback(), 60 * 60 * 1000);
  }, delay);

  log(`Popularity timer scheduled to start in ${Math.round(delay / 1000)} seconds`);
};
