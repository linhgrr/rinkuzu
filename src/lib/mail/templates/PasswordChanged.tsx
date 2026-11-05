import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

import {
  container,
  footer,
  heading,
  hr,
  link,
  logoContainer,
  logoImg,
  main,
  paragraph,
  EMAIL_LOGO_URL,
} from './styles';

interface PasswordChangedProps {
  resetUrl?: string;
}

export function PasswordChanged({ resetUrl }: PasswordChangedProps) {
  const logoSrc = EMAIL_LOGO_URL;
  return (
    <Html>
      <Head />
      <Preview>Your RinKuzu password was just changed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img src={logoSrc} alt="RinKuzu" style={logoImg} />
          </Section>
          <Heading as="h2" style={heading}>
            Password changed
          </Heading>
          <Text style={paragraph}>
            Your account password was just updated. If you did this, no further action is needed.
          </Text>
          <Text style={paragraph}>
            <strong>Wasn&apos;t you?</strong>{' '}
            {resetUrl ? (
              <>
                Reset your password immediately:{' '}
                <Link href={resetUrl} style={link}>
                  {resetUrl}
                </Link>{' '}
                and contact support.
              </>
            ) : (
              <>Reset your password from the sign-in page and contact support.</>
            )}
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            For your security we never include account passwords in any email we send.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
