export const welcomeNewAccount = ({ prename }: { prename: string }) => {
  return (
    <div>
      <h1 safe>Welcome {prename}!</h1>
      <p>
        Thank you for trusting in Kompakkt. With your new account, you will be able to upload &
        annotate content to Kompakkt.
      </p>
    </div>
  );
};
