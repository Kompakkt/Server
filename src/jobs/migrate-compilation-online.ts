import { compilationCollection, migrationCollection, Migrations } from 'src/mongo';

/**
 * Adds an "online" field to all compilation documents, depending on whether a password was previously set.
 * The "password" field is removed after the migration, as it is no longer needed.
 */
export const migrateCompilationOnline = async () => {
  const result = await migrationCollection.findOne({
    name: Migrations.migrateCompilationOnlineField,
  });
  if (result) return;

  try {
    const cursor = compilationCollection.find({});
    for await (const compilation of cursor) {
      if ('online' in compilation) continue;

      // Check if password exists at all and if its empty or not
      // No password equals online, any password equals offline
      const isOnline = (() => {
        const password = ('password' in compilation ? compilation.password : '')?.toString();
        return password?.trim().length === 0;
      })();

      const updateResult = await compilationCollection.updateOne(
        { _id: compilation._id },
        { $set: { online: isOnline }, $unset: { password: '' } },
      );
      // Check for errors
      if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
        throw new Error(`Failed to update compilation with ID ${compilation._id.toString()}`);
      }
    }

    await migrationCollection.insertOne({
      name: Migrations.migrateCreatorAndAccessFields,
      completedAt: Date.now(),
    });
  } catch (err) {
    console.error('Error during migration of compilation online field:', err);
  }
};
