# ISKONOMY Privacy Notice

**Last updated:** 20 November 2026

## Usage Analytics

ISKONOMY offers optional usage analytics to help its developer understand how frequently the application is launched.

When ISKONOMY is first launched, users can choose to allow usage analytics or continue without them. Analytics are disabled unless the user chooses to enable them.

Users can change their preference at any time under **Settings → Privacy & Usage Analytics**.

When enabled, the application sends a launch event containing only the event name `app_launched`. No installation UUID, account identifier or character identifier is included in the event payload.

## EVE Online ESI Data

ISKONOMY uses EVE Online's ESI API to retrieve information authorised by the user, including character, corporation and financial information where the relevant permissions have been granted.

ESI authentication credentials and retrieved data are handled separately from optional usage analytics.

Authenticated ESI requests are made to CCP's services. ESI credentials and retrieved financial records are not transmitted to ISKONOMY's usage analytics service.

Users can manage and revoke linked ESI authorisations through the application's ESI Connections interface.

## Information Collected

When usage analytics are enabled, ISKONOMY transmits a single application-launch event per application session to its telemetry service. The telemetry database stores the total number of launches for each UTC day, rather than individual launch histories.

The application also stores the user's analytics preference locally so that the choice persists between sessions.

## Information Not Included in Usage Telemetry

ISKONOMY does not include the following information in usage telemetry:

- Installation identifiers or UUIDs.
- EVE Online character names or account identifiers.
- ESI access or refresh tokens.
- Wallet balances, transactions, market orders or income records.
- Operating system details or hardware specifications.
- Error reports or detailed application activity.

## Storage and Processing

Usage events are transmitted securely to ISKONOMY's self-hosted telemetry service at `iskonomy.r3dit.space`.

The telemetry database stores aggregate daily launch counts. It does not store IP addresses or identifiers associated with individual launch events.

Network infrastructure used to deliver requests may process technical connection information, including IP addresses, independently of the telemetry database.

Aggregated launch statistics are collected to measure ISKONOMY's adoption and activity. They may also be used to support an application to the [EVE Online Partnership Programme](https://www.eveonline.com/partners).

## Data Retention

Daily aggregate launch counts are retained for approximately 12 calendar months. An automated cleanup process runs on startup and at least once every 24 hours to remove expired daily records.

Disabling telemetry stops future collection but does not remove previously recorded aggregate daily totals, which cannot be associated with a particular installation through the telemetry database.

## Your Choices

Users can accept or decline optional usage analytics during the first-launch disclosure.

The preference can subsequently be changed under **Settings → Privacy & Usage Analytics**.

Declining or disabling analytics prevents future telemetry events from being transmitted. Enabling analytics permits a launch event for the current application session.

## Privacy Enquiries

For questions about usage analytics, data retention or requests relating to your information, contact:

**dk21eve@gmail.com**

## Applicable Privacy Rules

The telemetry database contains daily aggregate launch counts without installation or user identifiers. Those aggregate counts are not intended to identify individual users.

Technical information processed in delivering requests may be subject to applicable data protection rules, including UK GDPR. The use of information stored on or accessed from a user's device may also be subject to the Privacy and Electronic Communications Regulations (PECR).

Optional usage analytics are enabled only following the user's affirmative choice. Where consent is required for this processing, users can withdraw it at any time through the application settings.

Where personal-data rights apply, individuals may have rights relating to access, erasure, restriction and other aspects of their information. Individuals may also complain to the [Information Commissioner's Office](https://ico.org.uk/make-a-complaint/).

## Changes to This Notice

This notice may be updated as ISKONOMY develops. The latest version will be available in the project's GitHub repository.