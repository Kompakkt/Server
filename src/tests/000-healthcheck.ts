import { assert, Express, get, test } from '.';

Express.Server.get('/', (req, rep) => {
  rep.status(200).send({ status: 'OK' });
});

test('check if server is listening for requests', async context => {
  const response = await get('/');
  assert.equal(response, { status: 'OK' });
});
