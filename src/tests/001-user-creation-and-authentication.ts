import { assert, DocumentResponse, faker, post, test } from '.';

test('create account', async () => {
  const prename = faker.name.firstName();
  const surname = faker.name.lastName();
  const fullname = `${prename} ${surname}`;
  const mail = faker.internet.email(prename, surname);
  const username = faker.internet.userName(prename, surname);
  const password = 'changeme';

  const data = { prename, surname, mail, fullname, username, password };

  const response = await post<DocumentResponse>('/user-management/register', data);
  assert.ok(response._id);
});
