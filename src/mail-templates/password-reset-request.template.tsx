export const passwordResetRequest = ({
  prename,
  resetToken,
  requestedByAdministrator,
}: {
  prename: string;
  resetToken: string;
  requestedByAdministrator?: boolean;
}) => {
  return (
    <div>
      <h1>Hello {prename}!</h1>
      {requestedByAdministrator ? (
        <div>
          <p>An administrator has initiated a password reset for your Kompakkt account.</p>
          <p>If this is not necessary from your side, you can ignore this mail.</p>
        </div>
      ) : (
        <div>
          <p>Somebody (hopefully you) requested to reset your Kompakkt account password.</p>
          <p>If this was not requested by you, you can ignore this mail.</p>
        </div>
      )}
      <p>
        To reset your password, follow this link and choose a new password:
        <br />
        <a href={`https://kompakkt.de/?action=passwordreset&token=${resetToken}`} target="_blank">
          https://kompakkt.de/?action=passwordreset&token={resetToken}
        </a>
      </p>

      <p>This link is only valid for 24 hours</p>
    </div>
  );
};
