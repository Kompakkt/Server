export const wrapInMailBody = ({
  jsx,
  subject,
  maxWidth,
}: {
  jsx: JSX.Element;
  subject: string;
  maxWidth?: number;
}) => {
  maxWidth = maxWidth ?? 600;

  const head = (
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title safe>{subject}</title>
    </head>
  );

  const body = (
    <body style="margin: 0; padding: 0;">
      <table border={0} cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 20px 0 30px 0;">
            <table
              align="center"
              border={0}
              cellpadding="0"
              cellspacing="0"
              width={maxWidth}
              style="border-collapse: collapse;"
            >
              <tr>
                <td align="center" style="padding: 40px 0 30px 0;">
                  <img
                    src="https://raw.githubusercontent.com/Kompakkt/Repo/master/src/assets/kompakkt-logo.png"
                    alt="Kompakkt Logo"
                    width={Math.min(maxWidth, 600)}
                  />
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px 40px 30px;">
                  <table border={0} cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="color: #153643; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px; padding: 20px 0 30px 0;">
                        {jsx}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 30px; color: #000000">
                  <table border={0} cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td
                        align="center"
                        style="color: #000000; font-family: Arial, sans-serif; font-size: 14px;"
                      >
                        &copy; {new Date().getFullYear()}{' '}
                        <a style="color: #000000" href="https://kompakkt.de/about">
                          Kompakkt
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  );
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">${head.toString()}${body.toString()}</html>`;
};
