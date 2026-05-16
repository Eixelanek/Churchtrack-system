<?php
/**
 * Cloudinary upload helper — no SDK required, uses REST API via cURL.
 * Reads credentials from environment variables set in Render.
 */

function uploadToCloudinary(string $base64Data, string $publicIdPrefix = 'profile_pictures'): array {
    $cloudName  = getenv('CLOUDINARY_CLOUD_NAME');
    $apiKey     = getenv('CLOUDINARY_API_KEY');
    $apiSecret  = getenv('CLOUDINARY_API_SECRET');

    if (!$cloudName || !$apiKey || !$apiSecret) {
        return ['success' => false, 'message' => 'Cloudinary credentials not configured.'];
    }

    // Strip data URI prefix if present
    if (preg_match('/^data:image\/\w+;base64,/', $base64Data)) {
        $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $base64Data);
    }

    $timestamp  = time();
    $publicId   = $publicIdPrefix . '/member_' . $timestamp . '_' . bin2hex(random_bytes(4));
    $folder     = 'churchtrack/' . $publicIdPrefix;

    // Build signature: alphabetical params (excluding file/api_key)
    $paramsToSign = [
        'folder'    => $folder,
        'public_id' => $publicId,
        'timestamp' => $timestamp,
    ];
    ksort($paramsToSign);
    $signatureString = '';
    foreach ($paramsToSign as $k => $v) {
        $signatureString .= ($signatureString ? '&' : '') . "$k=$v";
    }
    $signatureString .= $apiSecret;
    $signature = sha1($signatureString);

    $postFields = [
        'file'      => 'data:image/jpeg;base64,' . $base64Data,
        'api_key'   => $apiKey,
        'timestamp' => $timestamp,
        'signature' => $signature,
        'folder'    => $folder,
        'public_id' => $publicId,
    ];

    $url = "https://api.cloudinary.com/v1_1/{$cloudName}/image/upload";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'message' => 'cURL error: ' . $curlError];
    }

    $result = json_decode($response, true);

    if ($httpCode === 200 && isset($result['secure_url'])) {
        return ['success' => true, 'url' => $result['secure_url'], 'public_id' => $result['public_id']];
    }

    $errMsg = $result['error']['message'] ?? ('Cloudinary upload failed (HTTP ' . $httpCode . ')');
    return ['success' => false, 'message' => $errMsg];
}
?>
