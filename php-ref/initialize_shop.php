<?php
$dev_data = array('id'=>'-1','firstname'=>'Developer','lastname'=>'','username'=>'dev_vikram','password'=>'5da283a2d990e8d8512cf967df5bc0d0','last_login'=>'','date_updated'=>'','date_added'=>'');
//if(!defined('base_url')) define('base_url','http://localhost/vtech-rsms/',);
if(!defined('base_url')) define('base_url','http://192.168.29.100/vtech-rsms/',);
//if(!defined('base_url')) define('base_url','http://192.168.29.25/vtech-rsms/',);
//if(!defined('base_url')) define('base_url','http://192.168.1.100/vtech-rsms/',);
if(!defined('base_app')) define('base_app', str_replace('\\','/',__DIR__).'/' );
// if(!defined('dev_data')) define('dev_data',$dev_data);
if(!defined('DB_SERVER')) define('DB_SERVER',"localhost");
if(!defined('DB_USERNAME')) define('DB_USERNAME',"root");
if(!defined('DB_PASSWORD')) define('DB_PASSWORD',"");
if(!defined('DB_NAME')) define('DB_NAME',"vikram_db");
//if(!defined('DB_NAME')) define('DB_NAME',"vtech_db");
// initialize.php mein jahan database connection ($conn) ban jata hai, uske theek niche:
//$check_lic = $conn->query("SELECT meta_value FROM system_info WHERE meta_field = 'license_status'")->fetch_array();
//$lic_status = $check_lic ? $check_lic['meta_value'] : 'inactive';

//if($lic_status != 'active' && !strpos($_SERVER['PHP_SELF'], 'login.php') && !strpos($_SERVER['PHP_SELF'], 'system_info')){
 //   die("<h1>Access Denied: Please Activate Software.</h1>");
//}
?>