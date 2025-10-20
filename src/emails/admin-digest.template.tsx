import * as React from 'react';
import { Heading, Text, Link, Section } from '@react-email/components';
import { ObjectId } from 'mongodb';
import {
  annotationCollection,
  compilationCollection,
  entityCollection,
  groupCollection,
  userCollection,
} from '../mongo';
import type { ServerDocument } from '../util/document-with-objectid-type';
import type { IAnnotation, ICompilation, IEntity, IGroup, IUserData } from '../common';
import { Configuration } from '../configuration';
import { EmailLayout } from './_base-layout';

// Table component with Tailwind styling
const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <table className="w-full border-collapse mb-6">{children}</table>
);

const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead>
    <tr className="border-b border-black bg-gray-100">{children}</tr>
  </thead>
);

const TableHeaderCell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="text-left p-2 font-semibold text-sm">{children}</th>
);

const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody>{children}</tbody>
);

const TableRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="border-b border-gray-200">{children}</tr>
);

const TableCell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="p-2 text-sm text-gray-700">{children}</td>
);

const Users = (users: ServerDocument<IUserData>[]) => {
  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Database identifier</TableHeaderCell>
        <TableHeaderCell>Fullname</TableHeaderCell>
        <TableHeaderCell>Username</TableHeaderCell>
        <TableHeaderCell>Email</TableHeaderCell>
        <TableHeaderCell>Created At</TableHeaderCell>
      </TableHeader>
      <TableBody>
        {users.map((user, index) => (
          <TableRow key={index}>
            <TableCell>{user._id.toString()}</TableCell>
            <TableCell>{user.fullname}</TableCell>
            <TableCell>{user.username}</TableCell>
            <TableCell>{user.mail}</TableCell>
            <TableCell>
              {new Date(new ObjectId(user._id).getTimestamp()).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const Entities = (entities: ServerDocument<IEntity<{}, false>>[]) => {
  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Database identifier</TableHeaderCell>
        <TableHeaderCell>Name</TableHeaderCell>
        <TableHeaderCell>Finished</TableHeaderCell>
        <TableHeaderCell>Published</TableHeaderCell>
        <TableHeaderCell>Media type</TableHeaderCell>
        <TableHeaderCell>Created by</TableHeaderCell>
        <TableHeaderCell>Link</TableHeaderCell>
        <TableHeaderCell>Created At</TableHeaderCell>
      </TableHeader>
      <TableBody>
        {entities.map((entity, index) => (
          <TableRow key={index}>
            <TableCell>{entity._id.toString()}</TableCell>
            <TableCell>{entity.name}</TableCell>
            <TableCell>{entity.finished ? 'Yes' : 'No'}</TableCell>
            <TableCell>{entity.online ? 'Yes' : 'No'}</TableCell>
            <TableCell>{entity.mediaType}</TableCell>
            <TableCell>
              {entity.creator.fullname} ({entity.creator.username})
            </TableCell>
            <TableCell>
              <Link
                href={new URL(
                  `/entity/${entity._id.toString()}`,
                  Configuration.Server.PublicURL,
                ).toString()}
                className="text-sky-500 underline"
              >
                Open in new Tab
              </Link>
            </TableCell>
            <TableCell>
              {new Date(new ObjectId(entity._id).getTimestamp()).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const Compilations = (compilations: ServerDocument<ICompilation<false>>[]) => {
  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Database identifier</TableHeaderCell>
        <TableHeaderCell>Name</TableHeaderCell>
        <TableHeaderCell># Entities</TableHeaderCell>
        <TableHeaderCell>Created by</TableHeaderCell>
        <TableHeaderCell>Link</TableHeaderCell>
        <TableHeaderCell>Created At</TableHeaderCell>
      </TableHeader>
      <TableBody>
        {compilations.map((compilation, index) => (
          <TableRow key={index}>
            <TableCell>{compilation._id.toString()}</TableCell>
            <TableCell>{compilation.name}</TableCell>
            <TableCell>{Object.keys(compilation.entities).length}</TableCell>
            <TableCell>
              {compilation.creator.fullname} ({compilation.creator.username})
            </TableCell>
            <TableCell>
              <Link
                href={new URL(
                  `/compilation/${compilation._id.toString()}`,
                  Configuration.Server.PublicURL,
                ).toString()}
                className="text-sky-500 underline"
              >
                Open in new Tab
              </Link>
            </TableCell>
            <TableCell>
              {new Date(new ObjectId(compilation._id).getTimestamp()).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const Groups = (groups: ServerDocument<IGroup>[]) => {
  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Database identifier</TableHeaderCell>
        <TableHeaderCell>Name</TableHeaderCell>
        <TableHeaderCell># Members</TableHeaderCell>
        <TableHeaderCell>Created by</TableHeaderCell>
        <TableHeaderCell>Created At</TableHeaderCell>
      </TableHeader>
      <TableBody>
        {groups.map((group, index) => (
          <TableRow key={index}>
            <TableCell>{group._id.toString()}</TableCell>
            <TableCell>{group.name}</TableCell>
            <TableCell>{group.members.length}</TableCell>
            <TableCell>
              {group.creator.fullname} ({group.creator.username})
            </TableCell>
            <TableCell>
              {new Date(new ObjectId(group._id).getTimestamp()).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const Annotations = (annotations: ServerDocument<IAnnotation>[]) => {
  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Database identifier</TableHeaderCell>
        <TableHeaderCell>Title</TableHeaderCell>
        <TableHeaderCell>Content</TableHeaderCell>
        <TableHeaderCell>Entity ID</TableHeaderCell>
        <TableHeaderCell>Compilation ID</TableHeaderCell>
        <TableHeaderCell>Created by</TableHeaderCell>
        <TableHeaderCell>Created At</TableHeaderCell>
      </TableHeader>
      <TableBody>
        {annotations.map((annotation, index) => (
          <TableRow key={index}>
            <TableCell>{annotation._id.toString()}</TableCell>
            <TableCell>{annotation.body.content.title}</TableCell>
            <TableCell>{annotation.body.content.description}</TableCell>
            <TableCell>
              <Link
                href={new URL(
                  `/entity/${annotation.target.source.relatedEntity}`,
                  Configuration.Server.PublicURL,
                ).toString()}
                className="text-sky-500 underline"
              >
                {annotation.target.source.relatedEntity}
              </Link>
            </TableCell>
            <TableCell>
              {annotation.target.source.relatedCompilation ? (
                <Link
                  href={new URL(
                    `/compilation/${annotation.target.source.relatedCompilation}`,
                    Configuration.Server.PublicURL,
                  ).toString()}
                  className="text-sky-500 underline"
                >
                  {annotation.target.source.relatedCompilation}
                </Link>
              ) : (
                'No compilation'
              )}
            </TableCell>
            <TableCell>{annotation.creator.name}</TableCell>
            <TableCell>
              {new Date(new ObjectId(annotation._id).getTimestamp()).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const RenderList = (items: unknown[], collection: string) => {
  if (collection === 'users') {
    return Users(items as ServerDocument<IUserData>[]);
  } else if (collection === 'entities') {
    return Entities(items as ServerDocument<IEntity<{}, false>>[]);
  } else if (collection === 'compilations') {
    return Compilations(items as ServerDocument<ICompilation<false>>[]);
  } else if (collection === 'groups') {
    return Groups(items as ServerDocument<IGroup>[]);
  } else if (collection === 'annotations') {
    return Annotations(items as ServerDocument<IAnnotation>[]);
  }
  return null;
};

interface AdminDigestEmailProps {
  reason: string;
}

export default async function AdminDigestEmail({ reason }: AdminDigestEmailProps) {
  const { users, entities, compilations, groups, annotations } = await generateAdminDigest();
  const Content = { users, entities, compilations, groups, annotations };

  return (
    <EmailLayout subject="Admin Digest - Weekly Report" maxWidth={1280}>
      <Heading className="text-2xl font-bold text-[#153643] mt-0 mb-4">Hello admins!</Heading>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-4">
        This digest has been sent for the following reason: {reason}
      </Text>

      <Text className="text-base leading-6 text-[#153643] mt-0 mb-6">
        Here is your weekly digest of new content on Kompakkt:
      </Text>

      {Object.entries(Content).map(([key, items]) => (
        <Section key={key} className="mb-8">
          <Heading className="text-xl font-semibold text-[#153643] mt-0 mb-4">
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </Heading>

          <Section className="bg-white border border-gray-600 rounded-lg p-2">
            {items.length === 0 ? (
              <Text className="text-base text-gray-600 italic">
                No new {key} in the last 7 days.
              </Text>
            ) : (
              RenderList(items, key)
            )}
          </Section>
        </Section>
      ))}
    </EmailLayout>
  );
}

// Function to fetch data and generate email (you can keep this separate or use it as needed)
export const generateAdminDigest = async (reason: string = 'Automatic digest every monday') => {
  // Anything created since 7 days ago 00:00
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - 7);
  currentDate.setHours(0, 0, 0, 0);
  const sinceTimestamp = Math.floor(currentDate.getTime() / 1000);

  const timestampQuery = {
    _id: { $gte: ObjectId.createFromTime(sinceTimestamp) },
  };

  const [users, entities, annotations, compilations, groups] = await Promise.all([
    userCollection.find(timestampQuery).toArray(),
    entityCollection.find(timestampQuery).toArray(),
    annotationCollection.find(timestampQuery).toArray(),
    compilationCollection.find(timestampQuery).toArray(),
    groupCollection.find(timestampQuery).toArray(),
  ]);

  return {
    reason,
    users,
    entities,
    annotations,
    compilations,
    groups,
  };
};

AdminDigestEmail.PreviewProps = {
  reason: 'Automatic digest every monday',
} as AdminDigestEmailProps;
