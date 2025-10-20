import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Link,
  Tailwind,
} from '@react-email/components';

interface EmailLayoutProps {
  children: React.ReactNode;
  subject: string;
  maxWidth?: number;
}

export function EmailLayout({ children, subject, maxWidth = 600 }: EmailLayoutProps) {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head>
        <title>{subject}</title>
      </Head>
      <Tailwind>
        <Body className="bg-white my-8 mx-8 font-sans">
          <Container className={`max-w-[${maxWidth}px] mx-auto py-8 px-8 bg-slate-50 rounded-xl`}>
            {/* Logo Section */}
            <Section className="text-center">
              <Img
                src="https://raw.githubusercontent.com/Kompakkt/Repo/master/src/assets/kompakkt-logo.png"
                alt="Kompakkt Logo"
                width={Math.min(maxWidth, 600)}
                className="mx-auto py-8"
                style={{
                  width: '100%',
                  maxWidth: `${Math.min(maxWidth, 600)}px`,
                  height: 'auto',
                  display: 'block',
                }}
              />
            </Section>

            {/* Content Section */}
            <Section className="py-8">
              <div className="text-[#153643] text-base leading-6">{children}</div>
            </Section>

            {/* Footer Section */}
            <Section className="text-center py-8">
              <Text className="text-sm text-black m-0">
                &copy; {currentYear}{' '}
                <Link href="https://kompakkt.de/about" className="text-black no-underline">
                  Kompakkt
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
