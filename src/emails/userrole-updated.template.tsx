import * as React from 'react';
import { Heading, Text, Link } from '@react-email/components';
import { EmailLayout } from './_base-layout';
import { UserRank } from '../common';
import { Configuration } from '../configuration';

const roleStrings: Record<UserRank, string> = {
  [UserRank.admin]: 'Admin',
  [UserRank.uploader]: 'Uploader',
  [UserRank.uploadrequested]: 'Waiting for upload permission',
  [UserRank.user]: 'User',
};

interface UserRoleUpdatedEmailProps {
  prename: string;
  prevRole: UserRank;
  newRole: UserRank;
}

export default function UserRoleUpdatedEmail({
  prename,
  prevRole,
  newRole,
}: UserRoleUpdatedEmailProps) {
  return (
    <EmailLayout subject="Your Kompakkt Account Status Has Changed">
      <Heading className="text-2xl font-bold text-[#153643] mt-0 mb-4">Hello {prename}!</Heading>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        Your status on Kompakkt has been changed from "{roleStrings[prevRole]}" to "
        {roleStrings[newRole]}".
      </Text>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-0">
        Visit your profile on{' '}
        <Link
          href={Configuration.Server.PublicURL}
          target="_blank"
          rel="noreferrer"
          className="text-sky-500 underline"
        >
          {Configuration.Server.PublicURL}
        </Link>{' '}
        to see what has changed.
      </Text>
    </EmailLayout>
  );
}

UserRoleUpdatedEmail.PreviewProps = {
  prename: 'Max',
  prevRole: UserRank.user,
  newRole: UserRank.uploader,
} as UserRoleUpdatedEmailProps;
