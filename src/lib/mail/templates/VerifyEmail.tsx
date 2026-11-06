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
  button,
  buttonContainer,
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

interface VerifyEmailProps {
  url: string;
}

export function VerifyEmail({ url }: VerifyEmailProps) {
  const logoSrc = EMAIL_LOGO_URL;
  return (
    <Html>
      <Head />
      <Preview>Verify your RinKuzu email: link expires in 24 hours</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img src={logoSrc} alt="RinKuzu" style={logoImg} />
          </Section>
          <Heading as="h2" style={heading}>
            Verify your email
          </Heading>
          <Text style={paragraph}>
            Welcome aboard. Click the button below to confirm this is your email address.
          </Text>
          <Section style={buttonContainer}>
            <Link href={url} style={button}>
              Verify email
            </Link>
          </Section>
          <Text style={paragraph}>
            Or paste this URL into your browser:
            <br />
            <Link href={url} style={link}>
              {url}
            </Link>
          </Text>
          <Text style={paragraph}>This link expires in 24 hours.</Text>

          <Hr style={hr} />

          <Text style={footer}>
            If you didn&apos;t create a RinKuzu account you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
