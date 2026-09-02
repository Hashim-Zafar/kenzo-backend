export function EmailTemplate( name:string, domain:string, token:string ) {
  // Construct the secure frontend landing page URL
  const confirmationUrl = `${domain}/verify-meeting?token=${token}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Booking</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Card -->
        <table width="100%" style="max-width: 570px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Logo / Header Placeholder -->
          <tr>
            <td align="left" style="padding-bottom: 24px;">
              <span style="font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">Your Company</span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td align="left">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                Confirm your booking
              </h1>
              <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                Hi ${name},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Thank you for choosing us! We have received your booking request. To finalize your schedule and secure your slot, please confirm your booking by clicking the button below.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 12px 0 28px 0;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${confirmationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: -0.2px;">
                      Confirm My Booking
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiration Notice -->
          <tr>
            <td align="left" style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                For security reasons, this confirmation link will expire in 24 hours.
              </p>
              <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                If you did not make this booking request, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
        
        <!-- Footer -->
        <table width="100%" style="max-width: 570px; padding-top: 20px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
              &copy; 2026 Your Company Name. All rights reserved.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
