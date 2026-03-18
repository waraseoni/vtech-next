<?php
require_once('../config.php');
Class Users extends DBConnection {
	private $settings;
	public function __construct(){
		global $_settings;
		$this->settings = $_settings;
		parent::__construct();
	}
	public function __destruct(){
		parent::__destruct();
	}
	public function save_users(){
		// 1. Password ko md5 mein badlen (yadi diya gaya hai)
		if(empty($_POST['password']))
			unset($_POST['password']);
		else
		$_POST['password'] = md5($_POST['password']);
		
		extract($_POST);
		
		$id = isset($id) ? $id : ''; 


		// Username Duplication Check
		$chk = $this->conn->query("SELECT id FROM users where username = '{$username}' ".(empty($id) ? "" : " and id != '{$id}' " ))->num_rows;

		if($chk > 0){
			
			return 3; // Username already exist
		}
			// ⭐ END FIX 1 ⭐
			
		$data = '';
		foreach($_POST as $k => $v){
			if(!in_array($k,array('id'))){
				if(!empty($data)) $data .=" , ";
				// ⭐ FIX 2: Security Improvement - SQL Injection Prevention
                $v = $this->conn->real_escape_string($v);
				$data .= " {$k} = '{$v}' ";
			}
		}

		// Agar user Administrator (1) hai, toh mechanic_id ko NULL set karein
		if(isset($type) && $type == 1){
			if(!empty($data)) $data .=" , ";
			$data .= " `mechanic_id` = NULL ";
		}

		if(empty($id)){
			$sql = "INSERT INTO users set {$data}";
		}else{
			$sql = "UPDATE users set {$data} where id = {$id}";
		}
		
		$save = $this->conn->query($sql);

		if($save){
			$id = empty($id) ? $this->conn->insert_id : $id;
			$this->settings->set_flashdata('success','User Details successfully saved.');
			
			// === AVATAR UPLOAD - NEW SIMPLE & RELIABLE METHOD ===
				if(isset($_FILES['img']) && $_FILES['img']['tmp_name'] != ''){
				    $upload_dir = base_app . 'uploads/avatars/';
				    if(!is_dir($upload_dir)){
				        mkdir($upload_dir, 0777, true);
				    }

				    // Extension nikaalo
				    $ext = pathinfo($_FILES['img']['name'], PATHINFO_EXTENSION);
				    $allowed = ['jpg', 'jpeg', 'png', 'gif'];
				    if(!in_array(strtolower($ext), $allowed)){
				        return 4; // New error code: Invalid image type
				    }

				    // Filename: avatars/{user_id}.ext
				    $fname = 'uploads/avatars/' . $id . '.' . $ext;

				    // Move file
				    $move = move_uploaded_file($_FILES['img']['tmp_name'], base_app . $fname);

				    if($move){
				        // Purani image delete karo (agar alag extension wali ho)
				        $old_avatar = $meta['avatar'] ?? '';
				        if(!empty($old_avatar) && file_exists(base_app . $old_avatar)){
				            // Sirf avatars folder ki files delete karo
				            if(strpos($old_avatar, 'uploads/avatars/') === 0){
				                unlink(base_app . $old_avatar);
				            }
				        }

				        // Database mein path save karo (without cache busting ?v= – browser cache handle kar lenge)
				        $this->conn->query("UPDATE users SET avatar = '{$fname}' WHERE id = '{$id}'");

				        // Agar current logged in user hai, toh session update karo
				        if($this->settings->userdata('id') == $id){
				            $this->settings->set_userdata('avatar', $fname);
				        }
				    } else {
				        // Upload fail – permission ya size issue
				        return 5; // Upload failed
				    }
				}
				// === END AVATAR UPLOAD ===

			// Agar logged in user apni profile update kar raha hai
			if($this->settings->userdata('id') == $id){
				foreach($_POST as $k => $v){
					if(!in_array($k,array('id','password'))){
						$this->settings->set_userdata($k,$v);
					}
				}
			}

			return 1; // Success
		}else{
			return 2; // Error in SQL
		}
	}

	public function delete_users(){
		extract($_POST);
		$avatar = $this->conn->query("SELECT avatar FROM users where id = $id")->fetch_array()['avatar'];
		$qry = $this->conn->query("DELETE FROM users where id = $id");
		if($qry){
			$this->settings->set_flashdata('success','User Details successfully deleted.');
			if(is_file(base_app.$avatar)) unlink(base_app.$avatar);
			return 1;
		}else{
			return false;
		}
	}
}

$users = new Users();
$action = !isset($_GET['f']) ? 'none' : strtolower($_GET['f']);
switch ($action) {
	case 'save':
		echo $users->save_users();
	break;
	case 'delete':
		echo $users->delete_users();
	break;
	default:
		break;
}