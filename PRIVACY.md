# ISKONOMY Privacy Notice

**Last updated:** 20 November 2026

## Usage Analytics

ISKONOMY offers optional usage analytics to help its developer understand how many installations are active and how frequently the application is launched.

When ISKONOMY is first launched, users can choose to allow usage analytics or continue without them. Analytics are disabled unless the user chooses to enable them.

Users can change their preference at any time under Settings → Privacy & Usage Analytics.

Usage analytics use a randomly generated installation identifier and application launch events. They do not include EVE Online character information, ESI credentials, wallet transactions, market orders or other financial information.

## EVE Online ESI Data

ISKONOMY uses EVE Online's ESI API to retrieve information authorised by the user, including character, corporation and financial information where the relevant permissions have been granted.

ESI authentication credentials and retrieved data are handled separately from optional usage analytics.

Authenticated ESI requests are made to CCP's services. ESI credentials and retrieved financial records are not transmitted to ISKONOMY's usage analytics service.

Users can manage and revoke linked ESI authorisations through the application's ESI Connections interface.

## Information Collected

When usage analytics are enabled, ISKONOMY sends the following information to its telemetry service:

- A randomly generated, persistent installation identifier (UUID).
- An event indicating that an installation has been registered.
- An event indicating that the application has been launched.

The installation identifier allows launch events to be associated with the same installation without using an EVE Online account identifier.

## Information Not Included in Usage Telemetry

ISKONOMY does not include the following information in usage telemetry:

- EVE Online character names or account identifiers.
- ESI access or refresh tokens.
- Wallet balances, transactions or income records.
- Operating system details or hardware specifications.
- Error reports or detailed application activity.

## Storage and Processing

Usage events are transmitted securely to ISKONOMY's self-hosted telemetry service at `iskonomy.r3dit.space`.

Telemetry records are stored in a database controlled by the ISKONOMY project.

Network infrastructure used to deliver requests may process technical connection information, including IP addresses, independently of the telemetry database.

Usage statistics are collected to measure ISKONOMY's adoption and activity. Aggregated statistics, such as installation counts and application launches, may also be used to support an application to the EVE Online Partnership Programme. Individual installation identifiers will not be shared as part of that application. (https://www.eveonline.com/partners)

## Data Retention

Individual application launch records are retained for a maximum of 12 calendar months from the date they are recorded.

Installation identifiers are retained while installations remain active. An installation identifier is automatically deleted after 12 months without recorded activity, provided no associated launch records remain within their retention period.

An automated cleanup process runs at least once every 24 hours to remove expired records.

Disabling telemetry stops future collection but does not automatically delete previously collected records.

For privacy enquiries or deletion requests, contact **dk21eve@gmail.com**.

## Your Choices

Users can accept or decline optional usage analytics during the first-launch disclosure.

The preference can subsequently be changed under Settings → Privacy & Usage Analytics.

Declining or disabling analytics prevents future telemetry events from being transmitted. Previously collected telemetry records remain subject to the retention policy described above.

Users can contact dk21eve@gmail.com with privacy enquiries or requests concerning their information.

Disabling analytics prevents future telemetry events from being sent. It does not automatically remove previously collected records.

## Privacy Enquiries

For questions about usage analytics, data retention or requests relating to your information, contact:

**dk21eve@gmail.com**

## Applicable Privacy Rules

The installation identifier is used for usage measurement and is not derived from an EVE Online account.

Depending on whether an individual is reasonably identifiable, the processing may be subject to UK GDPR as well as the Privacy and Electronic Communications Regulations (PECR).

Where applicable, individuals may have rights relating to access, deletion, objection and other aspects of their personal information.

## Changes to This Notice

This notice may be updated as ISKONOMY develops. The latest version will be available in the project's GitHub repository.