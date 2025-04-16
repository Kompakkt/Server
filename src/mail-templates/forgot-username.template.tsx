export const forgotUsername = ({ prename, username }: { prename: string; username: string }) => {
  return (
    <div>
      <h1 safe>Hello {prename}!</h1>
      <p>You seem to have forgotten your Kompakkt username, but no worries, we still know it!</p>
      <p>
        Your username is: <strong safe>{username}</strong>
      </p>

      <p>
        Head back to Kompakkt and log in:
        <br />
        <a safe href={`https://kompakkt.de/?action=login&username=${username}`}>
          https://kompakkt.de/?action=login&username={username}
        </a>
      </p>
    </div>
  );
};
