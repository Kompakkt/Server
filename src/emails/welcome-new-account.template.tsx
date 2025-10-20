import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { EmailLayout } from './_base-layout';

interface WelcomeNewAccountEmailProps {
  prename: string;
}

export default function WelcomeNewAccountEmail({ prename }: WelcomeNewAccountEmailProps) {
  return (
    <EmailLayout subject={`Welcome ${prename}!`}>
      <Heading className="text-2xl font-bold text-[#153643] mt-0 mb-4">Welcome {prename}!</Heading>
      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        Thank you for trusting in Kompakkt. With your new account, you will be able to upload &
        annotate content to Kompakkt.
      </Text>
    </EmailLayout>
  );
}

WelcomeNewAccountEmail.PreviewProps = {
  prename: 'John',
} as WelcomeNewAccountEmailProps;
