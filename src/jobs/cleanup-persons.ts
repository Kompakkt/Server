import { combinePersons } from 'src/routers/modules/cleaning/combine-persons';

export const cleanupPersons = async () => {
  await combinePersons();
};
