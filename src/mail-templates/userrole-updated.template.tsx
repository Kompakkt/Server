import { UserRank } from 'src/common';

const roleStrings: Record<UserRank, string> = {
  [UserRank.admin]: 'Admin',
  [UserRank.uploader]: 'Uploader',
  [UserRank.uploadrequested]: 'Waiting for upload permission',
  [UserRank.user]: 'User',
};

export const updatedUserRole = ({
  prename,
  prevRole,
  newRole,
}: {
  prename: string;
  prevRole: UserRank;
  newRole: UserRank;
}) => {
  return (
    <div>
      <h1>Hello {prename}!</h1>
      <p>
        Your status on Kompakkt has been changed from "{roleStrings[prevRole]}" to "
        {roleStrings[newRole]}".
      </p>
      <p>
        Visit your profile on{' '}
        <a href="https://kompakkt.de/" target="_blank">
          https://kompakkt.de/
        </a>{' '}
        to see what has changed`,
      </p>
    </div>
  );
};
