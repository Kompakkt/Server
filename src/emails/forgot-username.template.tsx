import * as React from 'react';
import { Heading, Text, Link } from '@react-email/components';
import { EmailLayout } from './_base-layout';

interface ForgotUsernameEmailProps {
  prename: string;
  username: string;
}

export default function ForgotUsernameEmail({ prename, username }: ForgotUsernameEmailProps) {
  const loginUrl = `https://kompakkt.de/?action=login&username=${username}`;

  return (
    <EmailLayout subject={`Your Kompakkt Username`}>
      <Heading className="text-2xl font-bold text-[#153643] mt-0 mb-4">Hello {prename}!</Heading>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        You seem to have forgotten your Kompakkt username, but no worries, we still know it!
      </Text>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        Your username is: <strong className="font-bold">{username}</strong>
      </Text>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        Head back to Kompakkt and log in:
      </Text>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        <Link href={loginUrl} className="text-sky-500 underline break-all">
          {loginUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

ForgotUsernameEmail.PreviewProps = {
  prename: 'Max',
  username: 'maxmustermann',
} as ForgotUsernameEmailProps;
