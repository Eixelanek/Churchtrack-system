<?php

/**
 * Sunday attendance for guest membership only counts qr_sessions rows where
 * the session was created as a preset (not custom), even if a custom event
 * reuses the name "Sunday Service".
 */
function guest_qr_session_is_preset_sunday_service(?string $serviceName, ?string $qrSessionEventType): bool
{
    $name = strtolower(trim((string) $serviceName));
    $type = strtolower(trim((string) $qrSessionEventType));

    return $name === 'sunday service' && $type === 'preset';
}

/**
 * Row from guest attendance query must include service_name and session_event_type (qs.event_type).
 */
function guest_attendance_row_is_preset_sunday(array $row): bool
{
    return guest_qr_session_is_preset_sunday_service(
        $row['service_name'] ?? null,
        $row['session_event_type'] ?? null
    );
}
