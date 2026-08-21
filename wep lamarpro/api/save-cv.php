<?php
error_reporting(0);
ini_set('display_errors', 0);
ini_set('session.gc_maxlifetime', 86400);
session_set_cookie_params(['lifetime' => 86400, 'path' => '/', 'samesite' => 'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$dataFile  = __DIR__ . '/../careers-data.json';
$uploadDir = __DIR__ . '/../uploads/cvs/';

function loadApplications($file) {
    if (!file_exists($file)) return ['applications' => []];
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : ['applications' => []];
}

function saveApplications($file, $data) {
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

// POST — تقديم طلب توظيف (عام)
if ($method === 'POST') {
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'تعذّر إنشاء مجلد الرفع — تحقق من صلاحيات السيرفر']);
            exit;
        }
    }

    $name     = sanitize($_POST['name']     ?? '');
    $email    = sanitize($_POST['email']    ?? '');
    $phone    = sanitize($_POST['phone']    ?? '');
    $position = sanitize($_POST['position'] ?? '');

    if (empty($name) || empty($email) || empty($phone)) {
        http_response_code(400);
        echo json_encode(['error' => 'البيانات ناقصة']);
        exit;
    }

    $cvPath = '';
    if (!empty($_FILES['cv']) && $_FILES['cv']['error'] === UPLOAD_ERR_OK) {
        $file    = $_FILES['cv'];
        $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['pdf', 'doc', 'docx'];

        if (!in_array($ext, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'نوع الملف غير مسموح، يُقبل PDF و DOC و DOCX فقط']);
            exit;
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'حجم الملف يتجاوز 5MB']);
            exit;
        }

        $filename = uniqid('cv_') . '.' . $ext;
        if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            $cvPath = 'uploads/cvs/' . $filename;
        }
    }

    $positionLabels = [
        'mobile-dev'    => 'مطوّر تطبيقات',
        'software-eng'  => 'مهندس برمجيات',
        'ai-specialist' => 'متخصص ذكاء اصطناعي',
        'other'         => 'أخرى'
    ];

    $item = [
        'id'           => uniqid('a_'),
        'name'         => $name,
        'email'        => $email,
        'phone'        => $phone,
        'position'     => $position,
        'positionLabel'=> $positionLabels[$position] ?? $position,
        'cv'           => $cvPath,
        'date'         => date('Y-m-d H:i'),
        'read'         => false
    ];

    $data = loadApplications($dataFile);
    array_unshift($data['applications'], $item);

    if (!saveApplications($dataFile, $data)) {
        http_response_code(500);
        echo json_encode(['error' => 'فشل حفظ البيانات — تحقق من صلاحيات الكتابة على السيرفر']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

// GET — جلب الطلبات (للمشرف فقط)
if ($method === 'GET') {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        echo json_encode(['error' => 'غير مصرح']);
        exit;
    }
    echo json_encode(loadApplications($dataFile));
    exit;
}

// DELETE — حذف طلب (للمشرف فقط)
if ($method === 'DELETE') {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        echo json_encode(['error' => 'غير مصرح']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id    = sanitize($input['id'] ?? '');
    $data  = loadApplications($dataFile);

    foreach ($data['applications'] as $app) {
        if ($app['id'] === $id && !empty($app['cv'])) {
            $path = __DIR__ . '/../' . $app['cv'];
            if (file_exists($path)) unlink($path);
        }
    }

    $data['applications'] = array_values(array_filter($data['applications'], fn($a) => $a['id'] !== $id));
    saveApplications($dataFile, $data);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
