import * as React from 'react';
import { BaseTemplate } from './base-template';
import { Heading, Text, Link } from '@react-email/components';

interface InternalInviteTemplateProps {
  role: 'super-admin' | 'admin' | 'member';
  inviteUrl: string;
}

export default function InternalInviteTemplate({ role, inviteUrl }: InternalInviteTemplateProps) {
  return (
    <BaseTemplate
      previewText={`You're invited to Melanin Kapital as ${role}`}
      title={`You're invited as ${role}`}
    >
      <Heading as="h2">You're invited</Heading>
      <Text>
        You've been invited to join Melanin Kapital as <strong>{role}</strong>.
      </Text>
      <Text>
        Click the link below to accept your invitation, set your password, and complete your profile.
      </Text>
      <Text>
        <Link href={inviteUrl}>Accept your invitation</Link>
      </Text>
      <Text>
        If you did not expect this email, you can safely ignore it.
      </Text>
    </BaseTemplate>
  );
}


