import { Elysia, t } from 'elysia';
import { Configuration } from 'src/configuration';
import configServer from 'src/server.config';
import { hostMonitorUI } from 'src/templates/host-monitor';
import { hostMonitor } from 'src/util/host-monitor';
import { authService } from './handlers/auth.service';
import { RouterTags } from './tags';

const monitoringRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/monitor', group =>
    group
      .get(
        '/',
        async ({ set, query: { token }, status }) => {
          if (token !== Configuration.Server.MonitoringToken) {
            return status(401, 'Unauthorized');
          }

          set.headers['Content-Type'] = 'text/html';
          set.headers['Content-Security-Policy'] =
            `style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com`;
          return hostMonitorUI();
        },
        {
          query: t.Object({
            token: t.String({
              description: 'Authentication token for accessing the host monitor',
            }),
          }),
          detail: {
            summary: 'Host Monitor',
            description: 'Provides a web interface for monitoring the host system.',
            responses: {
              200: {
                description: 'HTML page with host monitoring information',
              },
              401: {
                description: 'Unauthorized access due to invalid or missing token',
              },
            },
            tags: [RouterTags.Monitoring],
          },
        },
      )
      .get(
        '/prometheus',
        ({ set, status, query: { token } }) => {
          if (token !== Configuration.Server.MonitoringToken) {
            return status(401, 'Unauthorized');
          }

          const metrics = hostMonitor.prometheusMetrics;
          set.headers['Content-Type'] = 'text/plain; version=0.0.4; charset=utf-8';
          return metrics;
        },
        {
          query: t.Object({
            token: t.String({
              description: 'Authentication token for accessing the Prometheus metrics',
            }),
          }),
          detail: {
            summary: 'Prometheus Metrics',
            description: 'Provides Prometheus metrics for monitoring the server.',
            responses: {
              200: {
                description: 'Prometheus metrics in plain text format',
              },
              401: {
                description: 'Unauthorized access due to invalid or missing token',
              },
            },
            tags: [RouterTags.Monitoring],
          },
        },
      ),
  );
export default monitoringRouter;
