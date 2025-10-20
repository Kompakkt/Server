import * as React from 'react';
import { Heading, Text, Link, Section, Button } from '@react-email/components';
import { EmailLayout } from './_base-layout';

interface PasswordResetRequestEmailProps {
  prename: string;
  resetToken: string;
  requestedByAdministrator?: boolean;
}

export default function PasswordResetRequestEmail({
  prename,
  resetToken,
  requestedByAdministrator = false,
}: PasswordResetRequestEmailProps) {
  const resetUrl = `https://kompakkt.de/?action=passwordreset&token=${resetToken}`;

  return (
    <EmailLayout subject="Password Reset Request">
      <Heading className="text-2xl font-bold text-[#153643] mt-0 mb-4">Hello {prename}!</Heading>

      {requestedByAdministrator ? (
        <>
          <Text className="text-base text-[#153643] mt-0 mb-4">
            An administrator has initiated a password reset for your Kompakkt account.
          </Text>
          <Text className="text-base text-[#153643] mt-0 mb-4">
            If this is not necessary from your side, you can ignore this mail.
          </Text>
        </>
      ) : (
        <>
          <Text className="text-base text-[#153643] mt-0 mb-4">
            Somebody (hopefully you) requested to reset your Kompakkt account password.
          </Text>
          <Text className="text-base text-[#153643] mt-0 mb-4">
            If this was not requested by you, you can ignore this mail.
          </Text>
        </>
      )}

      <Text className="text-base text-[#153643] mt-0 mb-6">
        To reset your password, click the button below and choose a new password:
      </Text>

      <Section className="text-center my-8">
        <Button
          href={resetUrl}
          className="bg-sky-500 text-white px-6 py-3 rounded-md text-base font-medium no-underline inline-block w-full box-border"
        >
          Reset Password
        </Button>
      </Section>

      <Text className="text-base text-gray-600 mb-0">
        Or copy and paste this link in your browser:
      </Text>
      <Text className="text-base text-gray-600 mt-0 break-all">
        <Link href={resetUrl} className="text-sky-500 underline">
          {resetUrl}
        </Link>
      </Text>

      <Text className="text-base text-[#153643] font-semibold">
        This link is only valid for 24 hours.
      </Text>
    </EmailLayout>
  );
}

PasswordResetRequestEmail.PreviewProps = {
  prename: 'Max',
  resetToken: 'sample-reset-token-123456789',
  requestedByAdministrator: false,
} as PasswordResetRequestEmailProps;
