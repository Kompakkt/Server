import { ObjectId } from 'mongodb';
import {
  annotationCollection,
  compilationCollection,
  entityCollection,
  groupCollection,
  userCollection,
} from '../mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import type { IAnnotation, ICompilation, IEntity, IGroup, IUserData } from 'src/common';
import { Configuration } from 'src/configuration';

const Users = (users: ServerDocument<IUserData>[]) => {
  return (
    <table style={{ width: '100%' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
          <th style={{ textAlign: 'left' }}>Database identifier</th>
          <th style={{ textAlign: 'left' }}>Fullname</th>
          <th style={{ textAlign: 'left' }}>Username</th>
          <th style={{ textAlign: 'left' }}>Email</th>
          <th style={{ textAlign: 'left' }}>Created At</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr>
            <td safe>{user._id.toString()}</td>
            <td safe>{user.fullname}</td>
            <td safe>{user.username}</td>
            <td safe>{user.mail}</td>
            <td safe>{new Date(new ObjectId(user._id).getTimestamp()).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Entities = (entities: ServerDocument<IEntity<{}, false>>[]) => {
  return (
    <table style={{ width: '100%' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
          <th style={{ textAlign: 'left' }}>Database identifier</th>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}>Finished</th>
          <th style={{ textAlign: 'left' }}>Published</th>
          <th style={{ textAlign: 'left' }}>Media type</th>
          <th style={{ textAlign: 'left' }}>Created by</th>
          <th style={{ textAlign: 'left' }}>Link</th>
          <th style={{ textAlign: 'left' }}>Created At</th>
        </tr>
      </thead>
      <tbody>
        {entities.map(entity => (
          <tr>
            <td safe>{entity._id.toString()}</td>
            <td safe>{entity.name}</td>
            <td safe>{entity.finished ? 'Yes' : 'No'}</td>
            <td safe>{entity.online ? 'Yes' : 'No'}</td>
            <td safe>{entity.mediaType}</td>
            <td safe>
              {' '}
              {entity.creator.fullname} ({entity.creator.username}){' '}
            </td>
            <td>
              <a
                href={new URL(
                  `/entity/${entity._id.toString()}`,
                  Configuration.Server.PublicURL,
                ).toString()}
                target="_blank"
              >
                Open in new Tab
              </a>
            </td>
            <td safe>{new Date(new ObjectId(entity._id).getTimestamp()).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Compilations = (compilations: ServerDocument<ICompilation<false>>[]) => {
  return (
    <table style={{ width: '100%' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
          <th style={{ textAlign: 'left' }}>Database identifier</th>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}># Entities</th>
          <th style={{ textAlign: 'left' }}>Created by</th>
          <th style={{ textAlign: 'left' }}>Link</th>
          <th style={{ textAlign: 'left' }}>Created At</th>
        </tr>
      </thead>
      <tbody>
        {compilations.map(compilation => (
          <tr>
            <td safe>{compilation._id.toString()}</td>
            <td safe>{compilation.name}</td>
            <td safe>{Object.keys(compilation.entities).length}</td>
            <td safe>
              {' '}
              {compilation.creator.fullname} ({compilation.creator.username}){' '}
            </td>
            <td>
              <a
                href={new URL(
                  `/compilation/${compilation._id.toString()}`,
                  Configuration.Server.PublicURL,
                ).toString()}
                target="_blank"
              >
                Open in new Tab
              </a>
            </td>
            <td safe>
              {new Date(new ObjectId(compilation._id).getTimestamp()).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Groups = (groups: ServerDocument<IGroup>[]) => {
  return (
    <table style={{ width: '100%' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
          <th style={{ textAlign: 'left' }}>Database identifier</th>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}># Members</th>
          <th style={{ textAlign: 'left' }}>Created by</th>
          <th style={{ textAlign: 'left' }}>Created At</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(group => (
          <tr>
            <td safe>{group._id.toString()}</td>
            <td safe>{group.name}</td>
            <td safe>{group.members.length}</td>
            <td safe>
              {' '}
              {group.creator.fullname} ({group.creator.username}){' '}
            </td>
            <td safe>{new Date(new ObjectId(group._id).getTimestamp()).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Annotations = (annotations: ServerDocument<IAnnotation>[]) => {
  return (
    <table style={{ width: '100%' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
          <th style={{ textAlign: 'left' }}>Database identifier</th>
          <th style={{ textAlign: 'left' }}>Title</th>
          <th style={{ textAlign: 'left' }}>Content</th>
          <th style={{ textAlign: 'left' }}>Entity ID</th>
          <th style={{ textAlign: 'left' }}>Compiation ID</th>
          <th style={{ textAlign: 'left' }}>Created by</th>
          <th style={{ textAlign: 'left' }}>Created At</th>
        </tr>
      </thead>
      <tbody>
        {annotations.map(annotation => (
          <tr>
            <td safe>{annotation._id.toString()}</td>
            <td safe>{annotation.body.content.title}</td>
            <td safe>{annotation.body.content.description}</td>
            <td>
              <a
                href={new URL(
                  `/entity/${annotation.target.source.relatedEntity}`,
                  Configuration.Server.PublicURL,
                ).toString()}
                target="_blank"
                safe
              >
                {annotation.target.source.relatedEntity}
              </a>
            </td>
            <td>
              {annotation.target.source.relatedCompilation ? (
                <a
                  href={new URL(
                    `/compilation/${annotation.target.source.relatedCompilation}`,
                    Configuration.Server.PublicURL,
                  ).toString()}
                  target="_blank"
                  safe
                >
                  {annotation.target.source.relatedCompilation}
                </a>
              ) : (
                'No compilation'
              )}
            </td>
            <td safe>{annotation.creator.name}</td>
            <td safe>
              {new Date(new ObjectId(annotation._id).getTimestamp()).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
  return <div></div>;
};

export const adminDigest = async (reason: string = 'Automatic digest every monday') => {
  // Anything created since 7 days ago 00:00
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - 7);
  currentDate.setHours(0, 0, 0, 0);
  const sinceTimestamp = Math.floor(currentDate.getTime() / 1000);

  const timestampQuery = {
    _id: { $gte: ObjectId.createFromTime(sinceTimestamp) },
  };

  const [users, entities, annotations, compilations, groups] = await Promise.all([
    await userCollection.find(timestampQuery).toArray(),
    await entityCollection.find(timestampQuery).toArray(),
    await annotationCollection.find(timestampQuery).toArray(),
    await compilationCollection.find(timestampQuery).toArray(),
    await groupCollection.find(timestampQuery).toArray(),
  ]);

  const Content = { users, entities, compilations, groups, annotations };

  return (
    <div>
      <h1>Hello admins!</h1>

      <p safe>This digest has been sent for the following reason: {reason}</p>

      <p>Here is your weekly digest of new content on Kompakkt:</p>

      {Object.entries(Content).map(([key, items]) => {
        return (
          <div>
            <h2 safe>{key.charAt(0).toUpperCase() + key.slice(1)}</h2>

            <div>
              {items.length === 0 ? (
                <p safe>No new {key} in the last 7 days.</p>
              ) : (
                RenderList(items, key)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
