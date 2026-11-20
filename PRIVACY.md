# ISKONOMY Privacy Notice

**Last updated:** 20 November 2026

## Overview

ISKONOMY is a desktop application for tracking EVE Online activity and income. Most application records are stored locally on the user's computer. Optional usage analytics are separate from EVE Online ESI connections and financial records.

This notice describes what ISKONOMY stores, what it sends over the network, and how users can manage that information. It does not claim that all information handled by ISKONOMY is anonymous: EVE character information may be associated with identifiable people in some circumstances.

## Optional Usage Analytics

ISKONOMY offers optional usage analytics to measure how often the application is launched.

On first launch, users can choose **Allow Analytics** or **Continue Without Analytics**. Analytics are disabled until the user explicitly enables them. The preference can be changed at any time under **Settings → Privacy & Usage Analytics**.

When enabled, ISKONOMY sends an HTTPS request to `https://iskonomy.r3dit.space/api/v1/events` containing only the event name `app_launched`. The application does not include an installation identifier, UUID, EVE character or account identifier, ESI credential, financial record, device identifier, operating-system information, or error report in this telemetry payload.

The telemetry service aggregates accepted launch events into daily launch totals. Its application database is designed to retain aggregate daily counts rather than individual installation records or per-launch histories. It does not use a persistent identifier to recognise returning installations or users. Consequently, these figures measure launches, **not unique users or installations**.

Enabling analytics may send a launch event for the current application session. Disabling analytics stops subsequent launch-event requests and cancels any request still in progress where possible. An event already received by the server cannot be withdrawn from its aggregate count.

## EVE Online ESI Connections

ISKONOMY allows users to authorise access to selected EVE Online data through CCP's EVE Online Single Sign-On (SSO) and ESI services. The application requests the permissions needed for the features the user chooses to connect, including character or corporation wallet information and, where enabled, killmail information.

ESI authentication takes place through CCP's login service. ISKONOMY uses an OAuth authorisation flow with PKCE and a temporary local callback listener. ESI requests are made to CCP's services; the reviewed application implementation does not forward ESI credentials, character records, wallet entries, or killmail data to the ISKONOMY usage analytics endpoint.

### Information stored locally

Depending on the features used, ISKONOMY may save the following on the user's computer:

- EVE Online character names and IDs, and associated corporation names and IDs.
- ESI authorisation status, permission-related connection information, token expiry and synchronisation metadata.
- ESI refresh tokens encrypted using Electron's operating-system-backed `safeStorage` facility. Short-lived access tokens are held in application memory during use.
- Imported character and corporation wallet journal records, including transaction dates, amounts, reference types, descriptions, party IDs and related transaction details.
- Killmail-related information and records used by relevant tracking features.
- Locally entered income, tracking and application settings data.

These records are stored in local application files and databases. Character IDs, names and transaction information can identify or be associated with an EVE character, and may be personal data in context.

The application does not operate a central ISKONOMY account database for these ESI records. Normal operating-system backups, synchronisation tools, security software or other software on the user's device may independently copy or process local application files.

### Unlinking ESI connections

Unlinking an ESI character, corporation or killmail connection removes the corresponding locally saved authorisation record and stops ISKONOMY using that connection for future authenticated synchronisation. It does **not** necessarily delete wallet journal entries, killmail records, income history or other information previously imported or generated while the connection was active.

Users may also revoke an ESI application's access through CCP's account authorisation controls. Revocation prevents future authorised access but does not itself erase data already stored locally by ISKONOMY.

### Deleting locally stored information

Unlinking is **not** a complete data-erasure function. ISKONOMY does not currently provide a verified, comprehensive in-app deletion function for every locally retained ESI record. Users seeking to remove all local application data can remove ISKONOMY's application-data files after closing the application, subject to any backups they maintain. This also removes local settings, tracking history and other saved data; uninstalling the application alone may not remove these files.

On Windows, the application data is normally located in the user's `%APPDATA%\iskonomy` folder. Users should verify the folder before deletion and back up anything they wish to keep. For assistance identifying locally stored information or requesting guidance on deletion, contact **dk21eve@gmail.com**.

## Network Connections and Infrastructure

ISKONOMY communicates with external services when required for features such as EVE SSO/ESI, public EVE information, pricing or updates, and, if enabled, usage analytics. Those services may process connection information under their own privacy notices.

The optional telemetry endpoint is hosted through infrastructure used by the ISKONOMY project, including Cloudflare and its origin server. Although the telemetry **application payload and aggregate database** do not contain user or installation identifiers, HTTP delivery necessarily involves technical connection information such as IP addresses. Infrastructure providers, reverse proxies, security systems and server logs may process or retain such information independently of the aggregate telemetry database.

The precise retention periods for infrastructure-level connection logs have not yet been independently verified. This notice therefore does **not** claim that no IP address is ever processed or logged anywhere in the request path.

## Purposes of Processing

- **Optional analytics:** measure daily application launch activity and understand adoption. Aggregate launch statistics may be used in support of an application to the EVE Online Partnership Programme.
- **ESI integration:** retrieve and locally display the EVE Online information authorised by the user, and support income and activity tracking.
- **Service delivery and security:** transmit requests, protect endpoints and diagnose service availability where necessary.

ISKONOMY does not use optional telemetry to build profiles of individual installations or EVE characters.

## Retention

- **Aggregate telemetry:** daily launch totals are intended to be retained for approximately 12 months, with automated cleanup of older daily totals. These aggregates cannot be selectively deleted for a particular installation because no installation identifier is stored with them.
- **Local ESI and tracking records:** saved on the user's device until removed by the user or a specific application feature. Unlinking authorisation does not automatically delete previously imported history.
- **ESI authorisations:** locally stored until unlinked, replaced or otherwise removed; short-lived access tokens expire and are refreshed as required.
- **Infrastructure logs:** retention depends on the applicable hosting, proxy and security configuration and has not been fully verified.

## Your Choices and Privacy Rights

Users can decline optional analytics on first launch or turn them off later under **Settings → Privacy & Usage Analytics**. Disabling analytics prevents future telemetry submissions, but previously recorded daily aggregate counts cannot be attributed to or individually removed for a particular user.

Users can manage ESI authorisations through the application's **ESI Connections** interface and can revoke access through CCP's authorisation controls. Removing a connection does not erase previously imported local records.

Where UK data protection law applies to identifiable information processed by the ISKONOMY project, individuals may have rights including access, rectification, erasure, restriction and objection, subject to applicable conditions and exemptions. Genuinely anonymous aggregate statistics cannot be linked back to an individual to fulfil an individual-record request.

For privacy questions or requests, contact **dk21eve@gmail.com**.

## Applicable Privacy Rules

UK GDPR and the Data Protection Act 2018 may apply where information relates to an identified or identifiable individual. The Privacy and Electronic Communications Regulations (PECR) may also apply to technologies that store or access information on a user's device. ISKONOMY seeks permission before enabling optional usage analytics, separately from the permissions a user grants to CCP for ESI access.

This notice describes the reviewed implementation and is not a statement that every infrastructure setting or legal obligation has been independently certified.

## Changes to This Notice

This notice may be updated as ISKONOMY develops. The current version is made available through the project's GitHub repository.