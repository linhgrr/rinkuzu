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
} from './styles';

interface ResetPasswordProps {
  url: string;
}

export function ResetPassword({ url }: ResetPasswordProps) {
  const logoSrc = 'https://i.ibb.co/WWGXBZXm/image-removebg-preview.png';
  return (
    <Html>
      <Head />
      <Preview>Reset your RinKuzu password — link expires in 30 minutes</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img src={logoSrc} alt="RinKuzu" style={logoImg} />
          </Section>
          <Heading as="h2" style={heading}>
            Reset your password
          </Heading>
          <Text style={paragraph}>
            We received a request to reset your password. Click the button below to choose a new
            one.
          </Text>
          <Section style={buttonContainer}>
            <Link href={url} style={button}>
              Reset password
            </Link>
          </Section>
          <Text style={paragraph}>
            Or paste this URL into your browser:
            <br />
            <Link href={url} style={link}>
              {url}
            </Link>
          </Text>
          <Text style={paragraph}>This link expires in 30 minutes.</Text>

          <Hr style={hr} />

          <Text style={footer}>
            If you didn&apos;t request a reset, you can safely ignore this email — your password
            won&apos;t change.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPassword;
