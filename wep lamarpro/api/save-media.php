<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'غير مصرح']);
    exit;
}

$dataFile = __DIR__ . '/../media-data.json';

function loadData($file) {
    if (!file_exists($file)) return ['items' => []];
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : ['items' => []];
}

function saveData($file, $data) {
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function sanitize($val) {
    return htmlspecialchars(strip_tags(trim($val ?? '')), ENT_QUOTES, 'UTF-8');
}

$method = $_SERVER['REQUEST_METHOD'];

// GET — جلب الكل
if ($method === 'GET') {
    echo json_encode(loadData($dataFile));
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// POST — إضافة أو تعديل
if ($method === 'POST') {
    $data = loadData($dataFile);

    $item = [
        'id'       => sanitize($input['id'] ?? uniqid('m_')),
        'type'     => in_array($input['type'] ?? '', ['news','events','videos']) ? $input['type'] : 'news',
        'title'    => sanitize($input['title'] ?? ''),
        'summary'  => sanitize($input['summary'] ?? ''),
        'date'     => sanitize($input['date'] ?? ''),
        'image'    => sanitize($input['image'] ?? ''),
        'videoUrl' => sanitize($input['videoUrl'] ?? ''),
    ];

    // تعديل موجود
    $found = false;
    foreach ($data['items'] as &$existing) {
        if ($existing['id'] === $item['id']) {
            $existing = $item;
            $found = true;
            break;
        }
    }
    unset($existing);

    // إضافة جديد
    if (!$found) {
        $item['id'] = uniqid('m_');
        array_unshift($data['items'], $item);
    }

    saveData($dataFile, $data);
    echo json_encode(['success' => true, 'item' => $item]);
    exit;
}

// DELETE — حذف
if ($method === 'DELETE') {
    $data = loadData($dataFile);
    $id   = sanitize($input['id'] ?? '');

    // حذف صورة/فيديو المرتبطة
    foreach ($data['items'] as $item) {
        if ($item['id'] === $id && !empty($item['image'])) {
            $imgPath = '../' . $item['image'];
            if (file_exists($imgPath)) unlink($imgPath);
        }
    }

    $data['items'] = array_values(array_filter($data['items'], fn($i) => $i['id'] !== $id));
    saveData($dataFile, $data);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
