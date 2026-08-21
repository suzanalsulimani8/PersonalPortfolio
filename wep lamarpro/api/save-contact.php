<?php
ini_set('session.gc_maxlifetime', 86400);
session_set_cookie_params(['lifetime' => 86400, 'path' => '/', 'samesite' => 'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$dataFile = __DIR__ . '/../contacts-data.json';

function loadContacts($file) {
    if (!file_exists($file)) return ['messages' => []];
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : ['messages' => []];
}

function saveContacts($file, $data) {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    if (!is_writable($dir)) {
        return false;
    }
    $result = file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    return $result !== false;
}

function sanitize($val) {
    return htmlspecialchars(strip_tags(trim($val ?? '')), ENT_QUOTES, 'UTF-8');
}

$method = $_SERVER['REQUEST_METHOD'];

// POST — حفظ رسالة جديدة (متاح للعموم)
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $name    = sanitize($input['name']    ?? '');
    $email   = sanitize($input['email']   ?? '');
    $phone   = sanitize($input['phone']   ?? '');
    $subject = sanitize($input['subject'] ?? '');
    $message = sanitize($input['message'] ?? '');

    if (empty($name) || empty($email) || empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'البيانات ناقصة']);
        exit;
    }

    $item = [
        'id'      => uniqid('c_'),
        'name'    => $name,
        'email'   => $email,
        'phone'   => $phone,
        'subject' => $subject,
        'message' => $message,
        'date'    => date('Y-m-d H:i'),
        'read'    => false
    ];

    $data = loadContacts($dataFile);
    array_unshift($data['messages'], $item);

    if (!saveContacts($dataFile, $data)) {
        http_response_code(500);
        echo json_encode(['error' => 'فشل حفظ البيانات — تحقق من صلاحيات الكتابة على السيرفر']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

// GET — جلب الرسائل (للمشرف فقط)
if ($method === 'GET') {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        echo json_encode(['error' => 'غير مصرح']);
        exit;
    }
    echo json_encode(loadContacts($dataFile));
    exit;
}

// PATCH — تحديد الرسالة كمقروءة (للمشرف فقط)
if ($method === 'PATCH') {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        echo json_encode(['error' => 'غير مصرح']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id    = sanitize($input['id'] ?? '');
    $data  = loadContacts($dataFile);
    foreach ($data['messages'] as &$msg) {
        if ($msg['id'] === $id) { $msg['read'] = true; break; }
    }
    unset($msg);
    saveContacts($dataFile, $data);
    echo json_encode(['success' => true]);
    exit;
}

// DELETE — حذف رسالة (للمشرف فقط)
if ($method === 'DELETE') {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        echo json_encode(['error' => 'غير مصرح']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id    = sanitize($input['id'] ?? '');
    $data  = loadContacts($dataFile);
    $data['messages'] = array_values(array_filter($data['messages'], fn($m) => $m['id'] !== $id));
    saveContacts($dataFile, $data);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
