APP FLOW

1. Registration for vendors:

- Vendor enters firstName, lastName, email, businessName, businessLogo, one or more fliers (optional), businessEmail, businessPhoneNumber, businessPhoneNumber2
  later in the app, they can update socials too.
- Step 2: they enter KYC DETAILS
  - user verification: upload nin and take a selfie:
    - OCR Matching picks up the name from nin and compares it with the first and last name, also picks up the nin phone number
    - FACE matching verifies the user selfie and NIN Details

- Step 3: Business verification details
  Upload at least one:
  - CAC Document: Pick up RC/BN NUmber from CAC Docs, verify, match it with the business name, check if it is active or deregistered.
  - Utility Bill: extract business name, address and date (make sure it's a recent date)
  - Or enter tax identification number

  NIN/RC NUMBER/BN NUMBER will be verifiied via interswitch

- Step 4 (can skip, later in dasbhboard):
  - Enter bank details to receive payouts.

- A user friendly business ID is generated for the business (maybe a slug sef)

- Add captcha to prevent bot generated profiles.

NOTE: we should also detect identity reuse attempts to reduce the risk of fraud (also brings down their score a lil' whenever such happens, or freeze their business account if it occurs multiple times)

NOTE (ai incoming): on frontend, we can add a PRE-OCR CHECK THAT: - checks blur level before OCR runs - tells user: “image too dark, retake” - auto-crops document region - detects glare / folded paper / cut-off edges

    👉 This is pre-OCR intelligence, not post-OCR analysis.

    This is powerful because:

    better input = better fraud detection accuracy

2. Login:

- Enter email/business id
- Enter password.
- No need for refresh token (return a long lived access token - 30 days).

3. Forgot Password:

- Enter email/business id
- Send email with otp in a queue
- Confirm otp
- reset password (check their passwordHistory hash and make sure it's not a password they have used before)

4. Business Profile

- AI builds a profile from weak signals:
  social media links (optional)
  business description text
  location metadata
  Output:
  “Likely electronics trader”
  “Mobile-first online seller”
  “High-frequency informal vendor”

- There should be a reason why their score is at a certain level, use the trust legder entry, feed it to the ai and it generates that for them.

5. Payment links:

- They have a generic payment link and QR CODE, takes customers to a site page where they can pay and can also see the trust score and history insights of business
- They can also create different services (which will have different payment links) and sometimes a different account for payment to be remitted to.
- Or generate quick one-time payment links for a particular payment (they enter the details).
- When buyers want to pay, they select whether it is a service that the person has rendered already or that the person will render later, if the person has rendered already (they give rating and feedback that we use to calculate trust score), if it is to be rendered later, they recieve an email where they can rate the person later.

6. Dispute

- Buyers can also see previous payment made that they have given (tied to only the email they submitted when making payment) and choose to add a feedback, collect evidence (maybe conversation screenshots), AI Reviews it, checks whether it is a truthful claim, also check whether buyer is a known complainer every single time and and yes, it affects trust score.
