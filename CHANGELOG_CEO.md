# CEO delivery edition - 4 November 2026

Based on the current full-stack Family Guard project source and its current individually saved code files.

Changes prepared for this delivery:

- Added `package-lock.json` for repeatable npm installation.
- Added API workflow and SMS-disabled-path tests. The Node runner reports 20 passing tests, including the workflow parent test.
- Kept background controls inert while the in-app pause is visible, trapped keyboard focus inside it and restored focus to the link input afterwards.
- Replaced an unsupported greeting emoji with the existing vector icon system.
- Increased key senior reading sizes and changed the warning toast to amber.
- Changed pending-alert copy so it does not claim a disconnected guardian has received the notification.
- Included demonstration instructions and a verification record.

The `.env.example` default remains 180 seconds. No real credentials, personal contacts, live incident data or installed dependency directory are included.

This delivery does not alter the previously hosted website. It is a runnable local source package.
