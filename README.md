# Blessed Vines School

A school website and working parent/teacher portal built with React and Express. The visual design follows the supplied school reference: navy, gold, white cards and a responsive dashboard. The supplied logo is retained.

## Run locally

```sh
npm install
npm run build
npm start
```

Open http://localhost:3000. Use **Parent login → Explore parent demo** or **Staff login → Explore teacher demo**. Demo records are fictional; changes persist in `data/school.json`. No shared password is required. The server binds to localhost by default.

`npm run dev` rebuilds the browser bundle when source files change. Run the server rather than opening `index.html` directly. React is bundled locally; no runtime Babel compiler or React CDN is required.

## Implemented

- Public home, about, academics (including reading), digital school, filterable achievements, news/calendar, admissions, contact and policy placeholder pages.
- The enquiry form saves requests for staff review; no false email-delivery confirmation.
- Cookie-based login with hashed random session tokens, password hashing, logout and password changes.
- Teacher-scoped student access and parent-to-child access checks on the server, not just in the interface.
- Staff registration of students and linked parent accounts. New parent credentials appear once after creation; share privately. Parents can change passwords in Settings.
- Grades and comments for three terms, progress charts and attendance records.
- Homework publishing, parent submissions via text/HTTPS links, teacher feedback.
- Private messages, behaviour observations, badges and digital portfolios.
- Public achievement publication requires staff confirmation of guardian permission. Public API responses omit student identities and account IDs.
- Class notes, HTTPS video/resource links, announcements and a maths practice exercise with server-checked answers and a persistent student history visible to the family and assigned teacher.
- In-app notifications; dashboard refreshes every 30 seconds and after writes.
- Staff publication of school news and calendar events.
- Responsive layout and a web app manifest. The service worker offers an offline notice and does **not** cache private student data. This is a web app, not a native Android/iOS application.

## Dedicated MongoDB database

Copy `.env.example` to `.env` locally. Configure a **new dedicated school database** using new credentials, not the previous job-site database:

```dotenv
MONGODB_URI=mongodb+srv://SCHOOL_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=vines_school
DEMO_MODE=false
NODE_ENV=production
```

The database and collections are created on the first successful write. Atlas cluster provisioning, its network access list and its database user must be configured in your Atlas account. No cloud database was created or connected during this change. Do not commit `.env` or put credentials in browser code.

Production requires MongoDB and HTTPS (session cookies are Secure in production). Configure `HOST=0.0.0.0` only when deploying behind the intended hosting/reverse-proxy environment. Use a currently supported Node.js release for deployment.

Create the first staff account while the local JSON server is stopped, or against MongoDB:

```sh
npm run create-user -- teacher@your-school-domain.org "Teacher Name" teacher
```

The command prints a randomly generated password once. `admin` and `parent` roles are also accepted. Admins can view all students; teachers see only assigned students. Do not use the JSON adapter across multiple running processes. It is intended for local development only.

## Email notifications

Notifications for grades, absence, homework, teacher messages and newly published school events are recorded in the in-app inbox. Non-demo parent accounts also receive a queued email record. **No email was sent during implementation or tests.**

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` and explicitly set `EMAIL_DELIVERY=true`. Run `npm run send-notifications` periodically with your hosting scheduler. The worker sends queued messages and leaves failed messages queued for retry. Schedule only one delivery worker at a time. Event emails announce publication; timed reminders before events are not implemented yet. Deploying an automatic worker is still required for automatic email delivery.

## School content

Contact details and students are examples authorised for this preview. Replace contact environment values with the school's real information. Configure `SCHOOL_VIDEO_URL` with an HTTPS video file to display the introduction film. No real film was supplied, so the website displays a clear coming-soon state. External classroom photos are illustrative; the achievement artwork is a visual sample, not a claim about real students. Public policies and the head teacher’s statement require school approval. Social links are omitted until actual profiles are supplied.

## Verification

```sh
npx playwright install chromium
npm test
```

Tests start an isolated server on port 3100 with a fresh JSON file in `/tmp`. They verify public navigation and mobile overflow, enquiry persistence, grade publication, homework submission, messaging, authentication, cross-family isolation, input limits, HTTPS links and publication consent. Screenshots are written to `/tmp/vines-review`.

## Before real deployment

Cloud configuration and email delivery are not enabled. Real photographs/video, school-approved policies and content remain to be supplied. Staff can upload JPG/PNG/WebP photos (10 MB maximum) and MP4/WebM videos (50 MB maximum) for class resources and student achievements. Homework submissions still support text and HTTPS links. There is no native mobile build, live video conferencing, fee payment, password reset by email, or operational backup/monitoring setup. The current release is a working local MVP, not a claim that the entire production platform is complete.

## Photo and video publication

Open `/staff-portal#classroom` for class resources or `/staff-portal#portfolio` for a student achievement. Choose **Upload photo / video**, select a file, complete the title and description, then publish/save. Administrators can choose **All families** without first registering students. Register a student to make their class available for targeted publication. Parents see class uploads in Digital classroom and student uploads in Digital portfolio. Public gallery publication additionally requires confirmed guardian permission.

Media metadata is stored in `media`. File bytes use MongoDB GridFS collections `schoolMedia.files` and `schoolMedia.chunks`; see the [MongoDB GridFS documentation](https://www.mongodb.com/docs/drivers/node/v6.2/fundamentals/gridfs/). In local development tests, bytes live outside `public/`, beside the isolated data file. `/api/media/:id` checks permissions on every request, including video range requests; unpublishing revokes anonymous access. Uploaded records reference their `mediaId`. Files are not exposed through a public static directory.

Only staff can upload; parents can view media for their linked children/classes. Supported formats are checked against file signatures; SVG/HTML uploads are rejected. The upload is saved with the form, and an unlinked file is removed if that form submission fails. Abandoned uploads after a browser/network interruption may need administrator cleanup. Uploads are buffered with a 50 MB server limit; deploy appropriate hosting quotas for a larger school. MP4/WebM playback depends on the browser’s codec support; no transcoding is performed.

## Private headteacher office

- `/staff-portal`: the existing school workspace for `admin` and `teacher` accounts. Teaching features are retained.
- `/director-portal`: private HR and salary workspace for `superadmin` only. The director can also use every school workspace with access to all students.
- Public registration cannot create a director. Accounts are provisioned through the owner-authorised server script. Passwords are hashed; generated initial credentials stay in ignored, permission-restricted local files. Do not share the director’s credentials with teaching staff.

The director can create and edit staff profiles (full name, subjects/role, contact details, private notes), upload/download/delete CVs, identity documents, diplomas and contracts, and retire a teacher from the active directory. Removal archives the record and stops projected salaries after the removal month; prior records, payments and documents remain available. It does not silently delete payroll history. Private documents accept PDF/JPG/PNG up to 10 MB and use GridFS with a separate `employeeDocuments` metadata collection and director-only download endpoint. They cannot be published through the public media API.

Payroll defaults to UGX (whole shillings); other supported currencies are kept separate without conversion. The directory is an HR register, not automatic creation of individual teacher login accounts. `employees` stores dated salary terms. The monthly ledger uses `payroll`, with one unique teacher/month document, a salary snapshot, payments, corrections and review state. Prior unpaid months are calculated from the teacher’s first salary month up to the current month, including previous years. This is a monthly agreed salary tracker; it does not calculate tax, leave adjustments or prorated pay, and does not transfer money.

Remaining balance = monthly salary minus active recorded payments. Partial payments are supported. Amounts use integer minor units to avoid rounding errors. Request IDs prevent repeated submissions from recording duplicate payments; optimistic concurrency checks protect the ledger against simultaneous writes. Corrections void a payment with a reason and preserve its history. The **OK** radio means “reviewed”; it never marks an unpaid balance as paid. Payment changes reset review status. Salary changes take effect from the selected current/future month and cannot overwrite an already recorded period. An archived teacher can still have their outstanding balance settled.

Tests cover directory forms, documents, desktop/mobile rendering, role denial (including ordinary administrators), cross-year arrears, partial payments, overpayment rejection, idempotency, simultaneous writes and preserved correction history. Test employees and salaries are created only in an isolated local test database.
