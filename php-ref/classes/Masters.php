<?php
require_once('../config.php');
Class Master extends DBConnection {
	private $settings;
	public function __construct(){
		global $_settings;
		$this->settings = $_settings;
		parent::__construct();
	}
	public function __destruct(){
		parent::__destruct();
	}
	function capture_err(){
		if(!$this->conn->error)
			return false;
		else{
			$resp['status'] = 'failed';
			$resp['error'] = $this->conn->error;
			return json_encode($resp);
			exit;
		}
	}
	function save_message(){
		extract($_POST);
		$data = "";
		foreach($_POST as $k =>$v){
			if(!in_array($k,array('id'))){
				if(!is_numeric($v))
					$v = $this->conn->real_escape_string($v);
				if(!empty($data)) $data .=",";
				$data .= " `{$k}`='{$v}' ";
			}
		}
		if(empty($id)){
			$sql = "INSERT INTO `message_list` set {$data} ";
		}else{
			$sql = "UPDATE `message_list` set {$data} where id = '{$id}' ";
		}
		
		$save = $this->conn->query($sql);
		if($save){
			$rid = !empty($id) ? $id : $this->conn->insert_id;
			$resp['status'] = 'success';
			if(empty($id))
				$resp['msg'] = "Your message has successfully sent.";
			else
				$resp['msg'] = "Message details has been updated successfully.";
		}else{
			$resp['status'] = 'failed';
			$resp['msg'] = "An error occured.";
			$resp['err'] = $this->conn->error."[{$sql}]";
		}
		if($resp['status'] =='success' && !empty($id))
		$this->settings->set_flashdata('success',$resp['msg']);
		if($resp['status'] =='success' && empty($id))
		$this->settings->set_flashdata('pop_msg',$resp['msg']);
		return json_encode($resp);
	}
	function delete_message(){
		extract($_POST);
		$del = $this->conn->query("DELETE FROM `message_list` where id = '{$id}'");
		if($del){
			$resp['status'] = 'success';
			$this->settings->set_flashdata('success',"Message has been deleted successfully.");

		}else{
			$resp['status'] = 'failed';
			$resp['error'] = $this->conn->error;
		}
		return json_encode($resp);

	}
	function delete_img(){
		extract($_POST);
		if(is_file($path)){
			if(unlink($path)){
				$resp['status'] = 'success';
			}else{
				$resp['status'] = 'failed';
				$resp['error'] = 'failed to delete '.$path;
			}
		}else{
			$resp['status'] = 'failed';
			$resp['error'] = 'Unkown '.$path.' path';
		}
		return json_encode($resp);
	}
	function save_service(){
		extract($_POST);
		$data = "";
		foreach($_POST as $k =>$v){
			if(!in_array($k,array('id'))){
				if(!empty($data)) $data .=",";
				$v = $this->conn->real_escape_string($v);
				$data .= " `{$k}`='{$v}' ";
			}
		}
		$check = $this->conn->query("SELECT * FROM `service_list` where `name` = '{$name}' ".(!empty($id) ? " and id != {$id} " : "")." ")->num_rows;
		if($this->capture_err())
			return $this->capture_err();
		if($check > 0){
			$resp['status'] = 'failed';
			$resp['msg'] = "Service Name already exists.";
			return json_encode($resp);
			exit;
		}
		if(empty($id)){
			$sql = "INSERT INTO `service_list` set {$data} ";
		}else{
			$sql = "UPDATE `service_list` set {$data} where id = '{$id}' ";
		}
			$save = $this->conn->query($sql);
		if($save){
			$bid = !empty($id) ? $id : $this->conn->insert_id;
			$resp['status'] = 'success';
			if(empty($id))
				$resp['msg'] = "New Service successfully saved.";
			else
				$resp['msg'] = " Service successfully updated.";
			
		}else{
			$resp['status'] = 'failed';
			$resp['err'] = $this->conn->error."[{$sql}]";
		}
		if($resp['status'] == 'success')
			$this->settings->set_flashdata('success',$resp['msg']);
			return json_encode($resp);
	}
	function delete_service(){
		extract($_POST);
		$del = $this->conn->query("UPDATE `service_list` set `delete_flag` = 1 where id = '{$id}'");
		if($del){
			$resp['status'] = 'success';
			$this->settings->set_flashdata('success'," Service successfully deleted.");
		}else{
			$resp['status'] = 'failed';
			$resp['error'] = $this->conn->error;
		}
		return json_encode($resp);

	}
	function save_mechanic(){
		extract($_POST);
		$data = "";
		foreach($_POST as $k =>$v){
			if(!in_array($k,array('id'))){
				if(!is_numeric($v))
					$v = $this->conn->real_escape_string($v);
				if(!empty($data)) $data .=",";
				$data .= " `{$k}`='{$v}' ";
			}
		}
		// save_mechanic function ke andar
if(isset($commission_percent)){
    $this->conn->query("INSERT INTO `mechanic_commission_history` set mechanic_id = '{$id}', commission_percent = '{$commission_percent}', effective_date = '".date('Y-m-d')."' ");
}

		// Check karein ki kya ye naya staff hai ya purana edit ho raha hai
		if(empty($id)){
			$sql = "INSERT INTO `mechanic_list` set {$data} ";
		}else{
			// Purani salary check karein history ke liye
			$old_salary_row = $this->conn->query("SELECT daily_salary FROM mechanic_list where id = '{$id}'")->fetch_array();
			$old_salary = $old_salary_row ? $old_salary_row['daily_salary'] : 0;
			$sql = "UPDATE `mechanic_list` set {$data} where id = '{$id}' ";
		}
		
		$save = $this->conn->query($sql);

		if($save){
			$mid = empty($id) ? $this->conn->insert_id : $id;
			$resp['status'] = 'success';

			// --- SALARY HISTORY LOGIC ---
			// Agar naya staff hai, toh pehla record history mein daalein
			// Agar purana staff hai aur salary badli hai, tabhi history mein daalein
			if(empty($id) || ($old_salary != $daily_salary)){
				$effective_date = date('Y-m-d'); // Aaj se naya rate lagu
				$this->conn->query("INSERT INTO `mechanic_salary_history` SET 
					mechanic_id = '{$mid}', 
					salary = '{$daily_salary}', 
					effective_date = '{$effective_date}'");
			}

			if(empty($id))
				$this->settings->set_flashdata('success',"New Mechanic successfully saved.");
			else
				$this->settings->set_flashdata('success',"Mechanic Details successfully updated.");
		}else{
			$resp['status'] = 'failed';
			$resp['err'] = $this->conn->error."[{$sql}]";
		}
		return json_encode($resp);
	}
	function delete_mechanic(){
		extract($_POST);
		$del = $this->conn->query("UPDATE `mechanic_list` set `delete_flag` = 1 where id = '{$id}'");
		if($del){
			$resp['status'] = 'success';
			$this->settings->set_flashdata('success'," Mechanic successfully deleted.");
		}else{
			$resp['status'] = 'failed';
			$resp['error'] = $this->conn->error;
		}
		return json_encode($resp);

	}
	// ... (Master class ke andar, jahan sare functions hain) ...

	// =========================================================================
	// PRODUCT FUNCTIONS (Added Prepared Statements)
	// =========================================================================

	function save_product(){
		extract($_POST);
		$resp = array('status'=>'success');
		
		// Un-setting fields that are handled separately (like files/image)
		// ...

		if(empty($id)){
			// INSERT (Prepared Statement)
			$stmt = $this->conn->prepare("INSERT INTO `product_list` (`name`, `description`, `price`, `status`) VALUES (?, ?, ?, ?)");
			// 'ssd i' means: string, string, double/float, integer
			$stmt->bind_param("ssdi", $name, $description, $price, $status);
		} else {
			// UPDATE (Prepared Statement)
			$stmt = $this->conn->prepare("UPDATE `product_list` SET `name`=?, `description`=?, `price`=?, `status`=? WHERE id = ?");
			// 'ssdi i' means: string, string, double/float, integer, integer (for ID)
			$stmt->bind_param("ssdii", $name, $description, $price, $status, $id);
		}

		if($stmt->execute()){
			$resp['id'] = empty($id) ? $this->conn->insert_id : $id;
			$resp['msg'] = 'Product Details successfully saved.';
			
			// Image upload logic (if you have one)
			if(isset($_FILES['img']) && $_FILES['img']['tmp_name'] != ''){
				if(!is_dir(base_app.'uploads/products'))
					mkdir(base_app.'uploads/products');
				$ext = pathinfo($_FILES['img']['name'], PATHINFO_EXTENSION);
				$fname = 'uploads/products/'.$resp['id'].'.'.$ext;
				$move = move_uploaded_file($_FILES['img']['tmp_name'],base_app.$fname);
				
				if($move){
					$img_stmt = $this->conn->prepare("UPDATE `product_list` SET `image_path` = ? WHERE id = ?");
					$img_stmt->bind_param("si", $fname, $resp['id']);
					$img_stmt->execute();
					$img_stmt->close();
				}
			}
			
		} else {
			$resp['status'] = 'failed';
			$resp['msg'] = 'Database Error: ' . $stmt->error;
		}
		$stmt->close();

		if($resp['status'] == 'success')
			$this->settings->set_flashdata('success', $resp['msg']);
		return json_encode($resp);
	}

	function delete_product(){
		extract($_POST);
		$resp = array('status'=>'success');
		
		// DELETE (Prepared Statement)
		$stmt = $this->conn->prepare("DELETE FROM `product_list` WHERE id = ?");
		$stmt->bind_param("i", $id);
		
		if($stmt->execute()){
			$resp['msg'] = 'Product Details successfully deleted.';
			// Optionally delete image file
			// $this->conn->query("DELETE FROM `product_list` where id = '{$id}' ");
		} else {
			$resp['status'] = 'failed';
			$resp['msg'] = 'Database Error: ' . $stmt->error;
		}
		$stmt->close();

		if($resp['status'] == 'success')
			$this->settings->set_flashdata('success', $resp['msg']);
		return json_encode($resp);
	}

// ... (rest of the Master class continues) ...
	function save_inventory(){
		extract($_POST);
		$data = "";
		foreach($_POST as $k =>$v){
			if(!in_array($k,array('id'))){
				if(!empty($data)) $data .=",";
				$v = $this->conn->real_escape_string($v);
				$data .= " `{$k}`='{$v}' ";
			}
		}
		if(empty($id)){
			$sql = "INSERT INTO `inventory_list` set {$data} ";
		}else{
			$sql = "UPDATE `inventory_list` set {$data} where id = '{$id}' ";
		}
			$save = $this->conn->query($sql);
		if($save){
			$bid = !empty($id) ? $id : $this->conn->insert_id;
			$resp['status'] = 'success';
			if(empty($id))
				$resp['msg'] = "New Stock has been saved successfully.";
			else
				$resp['msg'] = " Stock has been updated successfully.";
			
		}else{
			$resp['status'] = 'failed';
			$resp['err'] = $this->conn->error."[{$sql}]";
		}
		if($resp['status'] == 'success')
			$this->settings->set_flashdata('success',$resp['msg']);
			return json_encode($resp);
	}
	function delete_inventory(){
		extract($_POST);
		$del = $this->conn->query("DELETE FROM `inventory_list` where id = '{$id}'");
		if($del){
			$resp['status'] = 'success';
			$this->settings->set_flashdata('success'," Stock has been deleted successfully.");
		}else{
			$resp['status'] = 'failed';
			$resp['error'] = $this->conn->error;
		}
		return json_encode($resp);

	}	
	function save_client(){
    extract($_POST);
    $data = "";
    foreach($_POST as $k =>$v){
        if(!in_array($k,array('id'))){
            if(!is_numeric($v))
                $v = $this->conn->real_escape_string($v);
            if(!empty($data)) $data .=",";
            $data .= " `{$k}`='{$v}' ";
        }
    }

    // ====== DUPLICATE MOBILE CHECK ======
    $contact_check = $this->conn->query("SELECT id FROM `client_list` WHERE contact = '{$contact}' AND delete_flag = 0 ".(!empty($id) ? " AND id != '{$id}'" : "")." ");
    if($contact_check->num_rows > 0){
        echo json_encode(['status' => 'failed', 'msg' => 'This Mobile/Whatsapp number is already registered!']);
        exit;
    }

    // ====== DUPLICATE EMAIL CHECK (अगर भरा है तो) ======
    if(!empty($email)){
        $email_check = $this->conn->query("SELECT id FROM `client_list` WHERE email = '{$email}' AND delete_flag = 0 ".(!empty($id) ? " AND id != '{$id}'" : "")." ");
        if($email_check->num_rows > 0){
            echo json_encode(['status' => 'failed', 'msg' => 'This Email/Mobile is already registered!']);
            exit;
        }
    }

    // ====== अगर सब ठीक है तो Save करो ======
    if(empty($id)){
        $sql = "INSERT INTO `client_list` SET {$data}";
    } else {
        $sql = "UPDATE `client_list` SET {$data} WHERE id = '{$id}'";
    }

    $save = $this->conn->query($sql);
    if($save){
        $resp['status'] = 'success';
        $resp['msg'] = empty($id) ? "Client has been added successfully." : "Client has been updated successfully.";
        $this->settings->set_flashdata('success', $resp['msg']);
    } else {
        $resp['status'] = 'failed';
        $resp['msg'] = 'An error occurred while saving client.';
        $resp['err'] = $this->conn->error;
    }

    echo json_encode($resp);
    exit;
}
	function delete_client(){
		extract($_POST);
		$del = $this->conn->query("UPDATE `client_list` set delete_flag = 1 where id = '{$id}'");
		if($del){
			$resp['status'] = 'success';
			$this->settings->set_flashdata('success',"Client has been deleted successfully.");

		}else{
			$resp['status'] = 'failed';
			$resp['error'] = $this->conn->error;
		}
		return json_encode($resp);
	}
	function save_transaction(){
    // Form se id nikalna (Edit mode ke liye)
    $id = isset($_POST['id']) ? $_POST['id'] : '';

    // ==========================================================
    // UPDATED: DATE AND CODE LOGIC START
    // ==========================================================
    // Agar form se date aayi hai toh wo, nahi toh current date
    $chosen_date = !empty($_POST['date_created']) ? $_POST['date_created'] : date("Y-m-d H:i:s");
    $_POST['date_created'] = $chosen_date; 

    // Only for new transaction (jab $id empty ho)
    if(empty($id)){
        $_POST['user_id'] = $this->settings->userdata('id');
        
        // Code generate karne ke liye select ki gayi date ka prefix use karein
        $prefix = date("Ymd", strtotime($chosen_date)); 
        $code = sprintf("%'.02d", 1);
        while(true){
            $check = $this->conn->query("SELECT * FROM `transaction_list` where code = '{$prefix}{$code}' ")->num_rows;
            if($check > 0){
                $code = sprintf("%'.02d", abs($code) + 1);
            }else{
                $_POST['code'] = $prefix.$code;
                break;
            }
        }
    }
    // ==========================================================
    // DATE AND CODE LOGIC END
    // ==========================================================

    // ==========================================================
    // NEW: SERVICE-ONLY COMMISSION CALCULATION LOGIC START
    // ==========================================================
    
    // Check karo agar Admin ne manually commission dala hai (Form se aayega)
    $manual_comm = isset($_POST['mechanic_commission_amount']) ? (float)$_POST['mechanic_commission_amount'] : 0;
    
    // Agar manually nahi dala gaya ya Admin ne field khali chhodi hai, to auto-calculate karein
    if($manual_comm <= 0){
        $service_total = 0;
        if(isset($_POST['service_price']) && is_array($_POST['service_price'])){
            foreach($_POST['service_price'] as $s_price){
                $service_total += (float)$s_price;
            }
        }
        
        // Mechanic ka commission percentage nikalna
        $m_id = isset($_POST['mechanic_id']) ? $_POST['mechanic_id'] : 0;
        $mech_data = $this->conn->query("SELECT commission_percent FROM mechanic_list WHERE id = '{$m_id}'")->fetch_assoc();
        $comm_percent = isset($mech_data['commission_percent']) ? (float)$mech_data['commission_percent'] : 0;
        
        // Final Commission Calculation (Sirf service par)
        $final_commission = ($service_total * $comm_percent) / 100;
        $_POST['mechanic_commission_amount'] = $final_commission;
    } else {
        // Agar Admin ne manual entry ki hai, to wahi rakhein
        $_POST['mechanic_commission_amount'] = $manual_comm;
    }
    // ==========================================================
    // NEW: COMMISSION LOGIC END
    // ==========================================================

    extract($_POST);
    $tid = !empty($id) ? $id : '';

    // Data string prepare karna
    $data = "";
    foreach($_POST as $k =>$v){
        if(!in_array($k,array('id')) && !is_array($_POST[$k])){
            if(!empty($data)) $data .=",";
            $v = $this->conn->real_escape_string($v);
            $data .= " `{$k}`='{$v}' ";
        }
    }

    if(empty($id)){
        $sql = "INSERT INTO `transaction_list` set {$data} ";
    }else{
        $sql = "UPDATE `transaction_list` set {$data} where id = '{$id}' ";
    }

    $save = $this->conn->query($sql);
    if(!$save){
        $resp['status'] = 'failed';
        $resp['err'] = $this->conn->error;
        return json_encode($resp);
    }

    $tid = empty($id) ? $this->conn->insert_id : $id;
    $resp['tid'] = $tid;
    $resp['status'] = 'success';

    // === SERVICES SAVE ===
    $this->conn->query("DELETE FROM `transaction_services` WHERE transaction_id = '{$tid}'");
    if(isset($service_id) && is_array($service_id)){
        $data = "";
        foreach($service_id as $k => $v){
            if(!empty($data)) $data .= ", ";
            $price = $this->conn->real_escape_string($service_price[$k]);
            $data .= "('{$tid}', '{$v}', '{$price}')";
        }
        if(!empty($data)){
            $this->conn->query("INSERT INTO `transaction_services` (`transaction_id`, `service_id`, `price`) VALUES {$data}");
        }
    }

    // === PRODUCTS SAVE ===
    $this->conn->query("DELETE FROM `transaction_products` WHERE transaction_id = '{$tid}'");
    if(isset($product_id) && is_array($product_id)){
        $data = "";
        foreach($product_id as $k => $v){
            $pid = $v;
            $qty = $this->conn->real_escape_string($product_qty[$k]);
            $price = $this->conn->real_escape_string($product_price[$k]);
            if(!empty($data)) $data .= ", ";
            $data .= "('{$tid}', '{$pid}', '{$qty}', '{$price}')";
        }
        if(!empty($data)){
            $save_products = $this->conn->query("INSERT INTO `transaction_products` (`transaction_id`, `product_id`, `qty`, `price`) VALUES {$data}");
            if(!$save_products){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to save products.';
                return json_encode($resp);
            }
        }
    }
	
    // ==================== IMAGE UPLOAD START ====================
    if(isset($_FILES['images']) && !empty($_FILES['images']['name'][0])) {
        $upload_dir = base_app . 'uploads/transactions/';
        if(!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }
        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $max_size = 10 * 1024 * 1024; 
        foreach($_FILES['images']['tmp_name'] as $key => $tmp_name) {
            if($_FILES['images']['error'][$key] != UPLOAD_ERR_OK) continue;
            $file_type = $_FILES['images']['type'][$key];
            $file_size = $_FILES['images']['size'][$key];
            $original_name = $_FILES['images']['name'][$key];
            if(!in_array($file_type, $allowed_types)) continue;
            if($file_size > $max_size) continue;
            $ext = pathinfo($original_name, PATHINFO_EXTENSION);
            $new_filename = 'job_' . $tid . '_' . time() . '_' . $key . '.' . $ext;
            $destination = $upload_dir . $new_filename;
            if(move_uploaded_file($tmp_name, $destination)) {
                $image_path = 'uploads/transactions/' . $new_filename;
                $this->conn->query("INSERT INTO transaction_images (transaction_id, image_path) VALUES ('{$tid}', '{$image_path}')");
            }
        }
    }
    // ==================== IMAGE UPLOAD END ====================

    if(empty($id))
        $resp['msg'] = "New Transaction successfully saved.";
    else
        $resp['msg'] = "Transaction successfully updated.";

    $this->settings->set_flashdata('success', $resp['msg']);
    return json_encode($resp);
}
	function delete_transaction(){
    if(!isset($_POST['id']) || empty($_POST['id'])){
        $resp['status'] = 'failed';
        $resp['msg'] = 'Invalid transaction ID';
        return json_encode($resp);
    }

    $id = $this->conn->real_escape_string($_POST['id']);

    // Optional: Check if transaction exists
    $check = $this->conn->query("SELECT id FROM transaction_list WHERE id = '{$id}'");
    if($check->num_rows == 0){
        $resp['status'] = 'failed';
        $resp['msg'] = 'Transaction not found';
        return json_encode($resp);
    }

    $del = $this->conn->query("DELETE FROM transaction_list WHERE id = '{$id}'");

    if($del){
        $resp['status'] = 'success';
        $this->settings->set_flashdata('success', "Transaction successfully deleted.");
    } else {
        $resp['status'] = 'failed';
        $resp['msg'] = 'Delete failed';
        $resp['error'] = $this->conn->error;
    }

    return json_encode($resp);
}
	function delete_transaction_image(){
    if(!isset($_POST['id']) || empty($_POST['id'])){
        $resp['status'] = 'failed';
        $resp['msg'] = 'Invalid image ID';
        return json_encode($resp);
    }

    $id = $this->conn->real_escape_string($_POST['id']);

    // Image path fetch
    $qry = $this->conn->query("SELECT image_path FROM transaction_images WHERE id = '{$id}'");
    if($qry->num_rows == 0){
        $resp['status'] = 'failed';
        $resp['msg'] = 'Image not found';
        return json_encode($resp);
    }

    $row = $qry->fetch_assoc();
    $file_path = base_app . $row['image_path'];

    // Delete physical file
    if(is_file($file_path)){
        unlink($file_path);
    }

    // Delete from database
    $del = $this->conn->query("DELETE FROM transaction_images WHERE id = '{$id}'");

    if($del){
        $resp['status'] = 'success';
        $this->settings->set_flashdata('success', "Photo successfully deleted.");
    } else {
        $resp['status'] = 'failed';
        $resp['msg'] = 'Database delete failed';
        $resp['error'] = $this->conn->error;
    }

    return json_encode($resp);
}

	function update_status(){
		extract($_POST);
		$update = $this->conn->query("UPDATE `transaction_list` set `status` = '{$status}' where id = '{$id}'");
		if($update){
			$resp['status'] = 'success';
		}else{
			$resp['status'] = 'failed';
			$resp['msg'] = "Transaction's status has failed to update.";
		}
		if($resp['status'] == 'success')
			$this->settings->set_flashdata('success', 'Transaction\'s Status has been updated successfully.');
		return json_encode($resp);
	}
	function search_products(){
    $term = $_GET['term'];
    $qry = $this->conn->query("SELECT id, name, price FROM product_list WHERE name LIKE '%$term%' AND delete_flag = 0 LIMIT 10");
    $data = [];
    while($row = $qry->fetch_assoc()){
        $data[] = [
            'id' => $row['id'],
            'label' => $row['name'],
            'price' => $row['price']
        ];
    }
    echo json_encode($data);
    exit;
}

function save_direct_sale(){
    extract($_POST);
    $data = "";
    foreach($_POST as $k => $v){
        if(!in_array($k,['id','product_id','qty','price'])){
            if(!empty($data)) $data .= ", ";
            $data .= "`$k`='".addslashes($v)."'";
        }
    }
    
    if(empty($id)){
        $code = 'DS-'.date('Ymd').'-'.rand(1000,9999);
        $data .= ", sale_code='$code'";
        $sql = "INSERT INTO direct_sales SET $data";
    }else{
        $sql = "UPDATE direct_sales SET $data WHERE id = $id";
    }
    
    $save = $this->conn->query($sql);
    if($save){
        $sale_id = empty($id) ? $this->conn->insert_id : $id;
        
        // Delete old items if update
        if(!empty($id)){
            $this->conn->query("DELETE FROM direct_sale_items WHERE sale_id = $id");
        }
        
        // Save items
        $total = 0;
        for($i=0; $i<count($product_id); $i++){
            $pid = $product_id[$i];
            $qty = $qty[$i];
            $price = $price[$i];
            $item_total = $qty * $price;
            $total += $item_total;
            
            $this->conn->query("INSERT INTO direct_sale_items (sale_id, product_id, qty, price) VALUES ($sale_id, $pid, $qty, $price)");
        }
        
        $this->conn->query("UPDATE direct_sales SET total_amount = $total WHERE id = $sale_id");
        
        $resp['status'] = 'success';
        $resp['id'] = $sale_id;
        $this->settings->set_flashdata('success','Direct Sale saved successfully.');
    }else{
        $resp['status'] = 'failed';
        $resp['msg'] = 'An error occurred';
    }
    return json_encode($resp);
}

function delete_direct_sale(){
    extract($_POST);
    $del = $this->conn->query("DELETE FROM direct_sales WHERE id = $id");
    if($del){
        $resp['status'] = 'success';
        $this->settings->set_flashdata('success','Direct Sale deleted successfully.');
    }else{
        $resp['status'] = 'failed';
    }
    return json_encode($resp);
}
function get_client_balance(){
    extract($_POST);
    header('Content-Type: application/json');
    
    // 1. Opening Balance (Table: client_list)
    $client_qry = $this->conn->query("SELECT opening_balance FROM client_list WHERE id = '{$id}'");
    $opening = ($client_qry && $client_qry->num_rows > 0) ? floatval($client_qry->fetch_assoc()['opening_balance']) : 0;

    // 2. Total Billed (Status 5 = Delivered | Table: transaction_list)
    // Note: Column name 'client_name' ID store karta hai
    $billed_qry = $this->conn->query("SELECT SUM(amount) as total FROM transaction_list WHERE client_name = '{$id}' AND status = 5");
    $total_billed = $billed_qry->fetch_assoc()['total'] ?? 0;

    // 3. Total Paid (Amount - Discount | Table: client_payments)
    $paid_qry = $this->conn->query("SELECT SUM(amount - discount) as paid FROM client_payments WHERE client_id = '{$id}'");
    $total_paid = $paid_qry->fetch_assoc()['paid'] ?? 0;

    // Final Calculation: (Opening + Bills) - Payments
    $balance = ($opening + $total_billed) - $total_paid;

    $resp['status'] = 'success';
    if($balance > 0){
        $resp['balance'] = number_format($balance, 2, '.', '');
        $resp['type'] = 'due';
        $resp['color'] = '#dc3545'; // Red
        $resp['label'] = 'Total Due Amount: ';
    } else {
        $resp['balance'] = number_format(abs($balance), 2, '.', '');
        $resp['type'] = 'advance';
        $resp['color'] = '#28a745'; // Green
        $resp['label'] = 'Advance Amount: ';
    }
    echo json_encode($resp);
    exit;
}
//function get_client_balance(){
 //   extract($_POST);
 //   header('Content-Type: application/json'); // Yeh line zaroori hai
 //   
 //   try {
        // 1. Opening Balance
//        $client_qry = $this->conn->query("SELECT opening_balance FROM client_list WHERE id = '{$id}'");
//        $opening = ($client_qry && $client_qry->num_rows > 0) ? floatval($client_qry->fetch_assoc()['opening_balance']) : 0;

        // 2. Total Billed (Status 5 = Delivered)
//        $billed_qry = $this->conn->query("SELECT SUM(amount) as total FROM transaction_list WHERE client_name = '{$id}' AND status = 5");
//        $total_billed = $billed_qry->fetch_assoc()['total'] ?? 0;
//
        // 3. Total Paid (Amount - Discount)
//        $paid_qry = $this->conn->query("SELECT SUM(amount - discount) as paid FROM client_payments WHERE client_id = '{$id}'");
//        $total_paid = $paid_qry->fetch_assoc()['paid'] ?? 0;
//
//        $balance = ($opening + $total_billed) - $total_paid;
//
//        $resp['status'] = 'success';
 //       if($balance > 0){
//            $resp['balance'] = number_format($balance, 2, '.', '');
//            $resp['type'] = 'due';
//            $resp['color'] = '#dc3545'; // Red color hex
//            $resp['label'] = 'Total Due: ';
//        } else {
//            $resp['balance'] = number_format(abs($balance), 2, '.', '');
//            $resp['type'] = 'advance';
//            $resp['color'] = '#28a745'; // Green color hex
//            $resp['label'] = 'Advance: ';
//        }
//        echo json_encode($resp);
//
//    } catch (Exception $e) {
//        echo json_encode(['status' => 'failed', 'msg' => $e->getMessage()]);
//    }
//    exit;
//}
function create_backup(){
    $resp = array();
    $backup_dir = __DIR__ . "/backups/"; // सही path - classes folder से relative
    if(!is_dir($backup_dir)){
        if(!mkdir($backup_dir, 0777, true)){
            $resp['status'] = 'failed';
            $resp['msg'] = 'Cannot create backup folder.';
            return json_encode($resp);
        }
    }
    
    $filename = "vikram_db_backup_".date("Y-m-d_H-i-s").".sql";
    $filepath = $backup_dir . $filename;
    
    // Simple test write
    if(!is_writable($backup_dir)){
        $resp['status'] = 'failed';
        $resp['msg'] = 'Backup folder is not writable. Check permissions.';
        return json_encode($resp);
    }
    
    $sql = "-- VTech-RSMS Backup\n-- ".date("Y-m-d H:i:s")."\n\n";
    
    $tables = [];
    $result = $this->conn->query("SHOW TABLES");
    while($row = $result->fetch_row()){
        $tables[] = $row[0];
    }
    
    foreach($tables as $table){
        $sql .= "DROP TABLE IF EXISTS `$table`;\n";
        
        $create = $this->conn->query("SHOW CREATE TABLE `$table`");
        $row_create = $create->fetch_row();
        $sql .= $row_create[1] . ";\n\n";
        
        $data = $this->conn->query("SELECT * FROM `$table`");
        while($row = $data->fetch_row()){
            $sql .= "INSERT INTO `$table` VALUES (";
            foreach($row as $k => $v){
                $v = addslashes($v);
                $sql .= "'$v'";
                if($k < count($row)-1) $sql .= ", ";
            }
            $sql .= ");\n";
        }
        $sql .= "\n";
    }
    
    if(file_put_contents($filepath, $sql) !== false){
        $resp['status'] = 'success';
        $resp['msg'] = 'Backup created: ' . $filename;
        $this->settings->set_flashdata('success', $resp['msg']);
    }else{
        $resp['status'] = 'failed';
        $resp['msg'] = 'Failed to save file. Check disk space or permissions.';
    }
    
    return json_encode($resp);
}

function delete_backup(){
    extract($_POST);
    $backup_dir = dirname(__FILE__,2) . "/backup/backups/";
    $file = $backup_dir . $file;
    if(file_exists($file)){
        unlink($file);
        $resp['status'] = 'success';
        $this->settings->set_flashdata('success','Backup deleted successfully.');
    }else{
        $resp['status'] = 'failed';
    }
    return json_encode($resp);
}		
		function save_settings(){
    extract($_POST);
    $resp = array('status' => 'success', 'msg' => 'Settings updated successfully.');

    // === STEP 1: Text Fields Update Karo (Direct SQL se system_info mein) ===
    $update_data = array(
        'name' => $name,
        'short_name' => $short_name,
        'email' => $email,
        'contact' => $contact,
        'address' => $address
    );

    foreach($update_data as $key => $value){
        // Check if key already exists
        $check_stmt = $this->conn->prepare("SELECT * FROM system_info WHERE meta_field = ?");
        $check_stmt->bind_param("s", $key);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        $check_stmt->close();

        $value_esc = $this->conn->real_escape_string($value);  // Escape for safety

        if($result->num_rows > 0){
            // Update
            $update_stmt = $this->conn->prepare("UPDATE system_info SET meta_value = ? WHERE meta_field = ?");
            $update_stmt->bind_param("ss", $value_esc, $key);
            if(!$update_stmt->execute()){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to update setting: ' . $key . ' - ' . $update_stmt->error;
                $update_stmt->close();
                return json_encode($resp);
            }
            $update_stmt->close();
        } else {
            // Insert
            $insert_stmt = $this->conn->prepare("INSERT INTO system_info (meta_field, meta_value) VALUES (?, ?)");
            $insert_stmt->bind_param("ss", $key, $value_esc);
            if(!$insert_stmt->execute()){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to insert setting: ' . $key . ' - ' . $insert_stmt->error;
                $insert_stmt->close();
                return json_encode($resp);
            }
            $insert_stmt->close();
        }
    }

    // === STEP 2: Content Files Save Karo (Welcome aur About) ===
    if(isset($content) && is_array($content)){
        if(isset($content['welcome'])){
            if(file_put_contents(base_app . 'welcome.html', $content['welcome']) === false){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to save welcome content.';
                return json_encode($resp);
            }
        }
        if(isset($content['about'])){
            if(file_put_contents(base_app . 'about.html', $content['about']) === false){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to save about content.';
                return json_encode($resp);
            }
        }
    }

    // === STEP 3: Logo Upload Handle Karo (Single File) ===
    if(isset($_FILES['img']) && $_FILES['img']['tmp_name'] != ''){
        $upload_dir = base_app . 'uploads/';
        if(!is_dir($upload_dir)) {
            if(!mkdir($upload_dir, 0777, true)){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to create uploads directory.';
                return json_encode($resp);
            }
        }

        $ext = pathinfo($_FILES['img']['name'], PATHINFO_EXTENSION);
        $fname = 'uploads/logo.' . $ext;  // Fixed name (overwrite purana)
        $move = move_uploaded_file($_FILES['img']['tmp_name'], $upload_dir . basename($fname));

        if($move){
            // Purani logo delete karo agar alag hai (optional)
            $old_logo = $this->settings->info('logo');
            if(!empty($old_logo) && file_exists(base_app . $old_logo) && $old_logo != $fname){
                unlink(base_app . $old_logo);
            }

            // Database mein update (same as above)
            $this->update_system_info('logo', $fname, $resp);  // Helper function call (neeche define karo)
            if($resp['status'] == 'failed') return json_encode($resp);
        } else {
            $resp['status'] = 'failed';
            $resp['msg'] = 'Failed to upload logo. Check file permissions or size.';
            return json_encode($resp);
        }
    }

    // === STEP 4: Cover Upload Handle Karo (Similar to Logo) ===
    if(isset($_FILES['cover']) && $_FILES['cover']['tmp_name'] != ''){
        $upload_dir = base_app . 'uploads/';
        if(!is_dir($upload_dir)) {
            if(!mkdir($upload_dir, 0777, true)){
                $resp['status'] = 'failed';
                $resp['msg'] = 'Failed to create uploads directory.';
                return json_encode($resp);
            }
        }

        $ext = pathinfo($_FILES['cover']['name'], PATHINFO_EXTENSION);
        $fname = 'uploads/cover.' . $ext;  // Fixed name
        $move = move_uploaded_file($_FILES['cover']['tmp_name'], $upload_dir . basename($fname));

        if($move){
            // Purani cover delete
            $old_cover = $this->settings->info('cover');
            if(!empty($old_cover) && file_exists(base_app . $old_cover) && $old_cover != $fname){
                unlink(base_app . $old_cover);
            }

            // Database mein update
            $this->update_system_info('cover', $fname, $resp);
            if($resp['status'] == 'failed') return json_encode($resp);
        } else {
            $resp['status'] = 'failed';
            $resp['msg'] = 'Failed to upload cover. Check file permissions or size.';
            return json_encode($resp);
        }
    }

    // === STEP 5: Banners Upload Handle Karo (Multiple, No DB) ===
    $banner_dir = base_app . 'uploads/banner/';
    if(!is_dir($banner_dir)) {
        if(!mkdir($banner_dir, 0777, true)){
            $resp['status'] = 'failed';
            $resp['msg'] = 'Failed to create banner directory.';
            return json_encode($resp);
        }
    }

    if(isset($_FILES['banners']) && count($_FILES['banners']['tmp_name']) > 0){
        for($i = 0; $i < count($_FILES['banners']['tmp_name']); $i++){
            if(!empty($_FILES['banners']['tmp_name'][$i])){
                $ext = pathinfo($_FILES['banners']['name'][$i], PATHINFO_EXTENSION);
                $fname = time() . '_' . str_replace(' ', '_', $_FILES['banners']['name'][$i]);  // Unique name
                $move = move_uploaded_file($_FILES['banners']['tmp_name'][$i], $banner_dir . $fname);

                if(!$move){
                    $resp['status'] = 'failed';
                    $resp['msg'] = 'Failed to upload banner: ' . $_FILES['banners']['name'][$i] . '. Check permissions.';
                    return json_encode($resp);
                }
            }
        }
    }

    // === Success: Flashdata Set Karo ===
    if($resp['status'] == 'success'){
        $this->settings->set_flashdata('success', $resp['msg']);
    }

    return json_encode($resp);
}

// Helper Function (Master class mein add karo, save_settings ke upar ya neeche)
function update_system_info($key, $value, &$resp){
    $check_stmt = $this->conn->prepare("SELECT * FROM system_info WHERE meta_field = ?");
    $check_stmt->bind_param("s", $key);
    $check_stmt->execute();
    $result = $check_stmt->get_result();
    $check_stmt->close();

    $value_esc = $this->conn->real_escape_string($value);

    if($result->num_rows > 0){
        $update_stmt = $this->conn->prepare("UPDATE system_info SET meta_value = ? WHERE meta_field = ?");
        $update_stmt->bind_param("ss", $value_esc, $key);
        if(!$update_stmt->execute()){
            $resp['status'] = 'failed';
            $resp['msg'] = 'Failed to update ' . $key . ': ' . $update_stmt->error;
        }
        $update_stmt->close();
    } else {
        $insert_stmt = $this->conn->prepare("INSERT INTO system_info (meta_field, meta_value) VALUES (?, ?)");
        $insert_stmt->bind_param("ss", $key, $value_esc);
        if(!$insert_stmt->execute()){
            $resp['status'] = 'failed';
            $resp['msg'] = 'Failed to insert ' . $key . ': ' . $insert_stmt->error;
        }
        $insert_stmt->close();
    }
}
function get_status_by_contact(){
    extract($_POST);
    // Mobile number se client ki latest transaction dhundhna
    $qry = $this->conn->query("SELECT t.*, c.contact 
                               FROM transaction_list t 
                               INNER JOIN client_list c ON t.client_name = c.id 
                               WHERE c.contact = '{$contact}' 
                               ORDER BY t.date_created DESC LIMIT 1");
    
    if($qry->num_rows > 0){
        $res = $qry->fetch_assoc();
        return json_encode(['status' => 'success', 'code' => $res['code']]);
    } else {
        return json_encode(['status' => 'failed', 'msg' => 'No record found for this mobile number.']);
    }
}
// Expense save karne ke liye
function save_expense(){
    extract($_POST);
    $data = "";
    foreach($_POST as $k =>$v){
        if(!in_array($k, array('id'))){
            if(!empty($data)) $data .=",";
            $v = $this->conn->real_escape_string($v);
            $data .= " `{$k}`='{$v}' ";
        }
    }
    if(empty($id)){
        $sql = "INSERT INTO `expense_list` set {$data}";
    }else{
        $sql = "UPDATE `expense_list` set {$data} where id = '{$id}'";
    }
    $save = $this->conn->query($sql);
    if($save){
        return json_encode(['status'=>'success']);
    }else{
        return json_encode(['status'=>'failed', 'error'=>$this->conn->error]);
    }
}

// Expense delete karne ke liye
function delete_expense(){
    extract($_POST);
    $del = $this->conn->query("DELETE FROM `expense_list` where id = '{$id}'");
    if($del){
        return json_encode(['status'=>'success']);
    }else{
        return json_encode(['status'=>'failed']);
    }
}
function save_multi_transaction(){
    // Response array banate hain (jaise baaki functions mein)
    $resp = array('status' => 'failed', 'msg' => 'No items processed');

    // Client ID aur items ko safely extract karo
    if(!isset($_POST['client_name']) || empty($_POST['client_name'])){
        $resp['msg'] = 'Client not selected';
        return json_encode($resp);
    }
    if(!isset($_POST['items']) || empty($_POST['items'])){
        $resp['msg'] = 'No items to save';
        return json_encode($resp);
    }

    $client_id = $this->conn->real_escape_string($_POST['client_name']);
    $items_json = $_POST['items'];
    $items = json_decode($items_json, true);

    if(!is_array($items) || count($items) == 0){
        $resp['msg'] = 'Invalid items data';
        return json_encode($resp);
    }

    $saved_count = 0;

    foreach($items as $item){
        // Required fields check (basic validation)
        if(empty($item['job_id']) || empty($item['item']) || empty($item['fault']) || empty($item['mechanic_id'])){
            continue; // Skip invalid item
        }

        // Unique Job ID banao (better format)
        $job_id = 'J' . date('Y') . str_pad(mt_rand(1,99999), 5, '0', STR_PAD_LEFT);

        // Unique transaction code
        $code = date('Ymd') . mt_rand(10, 99); // Example: 202512211234

        // Safe escape sab fields
        $job_id_esc       = $this->conn->real_escape_string($job_id);
        $code_esc         = $this->conn->real_escape_string($code);
        $mechanic_id_esc  = $this->conn->real_escape_string($item['mechanic_id']);
        $item_esc         = $this->conn->real_escape_string($item['item']);
        $fault_esc        = $this->conn->real_escape_string($item['fault']);
        $uniq_id_esc      = $this->conn->real_escape_string($item['uniq_id'] ?? '');
        $remark_esc       = $this->conn->real_escape_string($item['remark'] ?? '');

        $sql = "INSERT INTO transaction_list (
                    client_name, 
                    mechanic_id,
                    job_id, 
                    code, 
                    item, 
                    fault, 
                    uniq_id, 
                    remark, 
                    amount, 
                    status, 
                    date_created
                ) VALUES (
                    '$client_id',
                    '$mechanic_id_esc',
                    '$job_id_esc',
                    '$code_esc',
                    '$item_esc',
                    '$fault_esc',
                    '$uniq_id_esc',
                    '$remark_esc',
                    '0',
                    '0',
                    NOW()
                )";

        if($this->conn->query($sql)){
            $saved_count++;
        } else {
            // Optional: log error
            error_log("Multi Transaction Save Error: " . $this->conn->error);
        }
    }

    if($saved_count > 0){
        $resp['status'] = 'success';
        $resp['count'] = $saved_count;
        $resp['msg'] = "$saved_count transactions saved successfully!";
        $this->settings->set_flashdata('success', $resp['msg']);
    } else {
        $resp['msg'] = 'Failed to save any transaction. Check data or database.';
    }

    return json_encode($resp);
}

function save_attendance(){
		extract($_POST);
		$curr_date = isset($curr_date) ? $curr_date : date('Y-m-d');
		
		// VARIABLES KO DEFINE KAREIN (Fix for Undefined Variable Warning)
		$user_type = $this->settings->userdata('type');
		$user_mechanic_id = $this->settings->userdata('mechanic_id');
		
		$errors = 0;
		
		foreach($mechanic_id as $k => $id){
			// SECURITY CHECK: Agar Admin nahi hai aur ID apni nahi hai, toh skip karein
			if($user_type != 1 && $id != $user_mechanic_id){
				continue; 
			}

			$stat = $status[$id];
			// Check if record exists
			$check = $this->conn->query("SELECT id FROM attendance_list WHERE mechanic_id = '{$id}' AND curr_date = '{$curr_date}'");
			if($check->num_rows > 0){
				$sql = "UPDATE attendance_list SET status = '{$stat}' WHERE mechanic_id = '{$id}' AND curr_date = '{$curr_date}'";
			}else{
				$sql = "INSERT INTO attendance_list (mechanic_id, status, curr_date) VALUES ('{$id}', '{$stat}', '{$curr_date}')";
			}
			$save = $this->conn->query($sql);
			if(!$save) $errors++;
		}

		if($errors == 0){
			$resp['status'] = 'success';
			$resp['msg'] = "Attendance successfully saved.";
		}else{
			$resp['status'] = 'failed';
			$resp['msg'] = "An error occurred while saving the attendance.";
		}
		return json_encode($resp);
	}
	function save_advance(){
    extract($_POST);
    $data = "";
    foreach($_POST as $k =>$v){
        if(!in_array($k,array('id'))){
            if(!empty($data)) $data .=",";
            $data .= " `{$k}`='{$this->conn->real_escape_string($v)}' ";
        }
    }
    if(empty($id)){
        $sql = "INSERT INTO advance_payments set {$data}";
    }else{
        $sql = "UPDATE advance_payments set {$data} where id = '{$id}'";
    }
    $save = $this->conn->query($sql);
    if($save){
        return json_encode(['status'=>'success']);
    }else{
        return json_encode(['status'=>'failed', 'err'=>$this->conn->error]);
    }
}

function delete_advance(){
    extract($_POST);
    $del = $this->conn->query("DELETE FROM advance_payments where id = '{$id}'");
    if($del){
        return json_encode(['status'=>'success']);
    }else{
        return json_encode(['status'=>'failed']);
    }
}
function update_salary_rate(){
    extract($_POST);
    // $_POST mein 'id', 'new_salary', aur 'effective_date' aayega

    if(empty($id) || empty($new_salary) || empty($effective_date)){
        return json_encode(array('status' => 'failed', 'msg' => 'Please fill all fields.'));
    }

    // 1. Mechanic list mein current salary update karein (taaki dashboard par dikhe)
    $update = $this->conn->query("UPDATE mechanic_list set daily_salary = '{$new_salary}' where id = '{$id}'");
    
    if($update){
        // 2. History table mein chuni hui Effective Date ke saath entry daalein
        // Isse system ko pata chalega ki kis din se naya rate calculate karna hai
        $this->conn->query("INSERT INTO `mechanic_salary_history` SET 
            mechanic_id = '{$id}', 
            salary = '{$new_salary}', 
            effective_date = '{$effective_date}'");
        
        return json_encode(array('status' => 'success'));
    }else{
        return json_encode(array('status' => 'failed', 'msg' => $this->conn->error));
    }
}
function delete_salary_history(){
    extract($_POST);
    // id yahan record ki primary id hai
    $delete = $this->conn->query("DELETE FROM `mechanic_salary_history` WHERE id = '{$id}'");
    if($delete){
        // DELETE karne ke baad, humein mechanic_list table mein 'daily_salary' 
        // ko update karna hoga jo sabse latest bachi hui salary hai.
        return json_encode(array('status' => 'success'));
    }else{
        return json_encode(array('status' => 'failed', 'error' => $this->conn->error));
    }
}
function update_history_entry(){
    extract($_POST);
    // h_id = history table ki primary id
    // h_salary = nayi salary
    // h_date = nayi effective date
    
    $update = $this->conn->query("UPDATE `mechanic_salary_history` SET 
        salary = '{$h_salary}', 
        effective_date = '{$h_date}' 
        WHERE id = '{$h_id}'");
    
    if($update){
        // Sabse latest salary ko mechanic_list mein bhi update kar dete hain
        // Taaki main table aur history humesha sync rahein
        $m_id_query = $this->conn->query("SELECT mechanic_id FROM `mechanic_salary_history` WHERE id = '{$h_id}'")->fetch_array();
        $m_id = $m_id_query['mechanic_id'];
        
        // Latest record nikalein
        $latest = $this->conn->query("SELECT salary FROM `mechanic_salary_history` WHERE mechanic_id = '$m_id' ORDER BY effective_date DESC, id DESC LIMIT 1")->fetch_array();
        $this->conn->query("UPDATE `mechanic_list` SET daily_salary = '{$latest['salary']}' WHERE id = '$m_id'");
        
        return json_encode(array('status' => 'success'));
    }
    return json_encode(array('status' => 'failed'));
}
}

$Master = new Master();
$action = !isset($_GET['f']) ? 'none' : strtolower($_GET['f']);
$sysset = new SystemSettings();
switch ($action) {
	case 'save_message':
		echo $Master->save_message();
	break;
	case 'delete_message':
		echo $Master->delete_message();
	break;
	case 'delete_img':
		echo $Master->delete_img();
	break;
	case 'save_service':
		echo $Master->save_service();
	break;
	case 'delete_service':
		echo $Master->delete_service();
	break;
	case 'save_mechanic':
		echo $Master->save_mechanic();
	break;
	case 'delete_mechanic':
		echo $Master->delete_mechanic();
	break;
	case 'save_client':
		echo $Master->save_client();
	break;
	case 'delete_client':
		echo $Master->delete_client();
	break;
	case 'save_product':
		echo $Master->save_product();
	break;
	case 'delete_product':
		echo $Master->delete_product();
	break;
	case 'save_inventory':
		echo $Master->save_inventory();
	break;
	case 'delete_inventory':
		echo $Master->delete_inventory();
	break;
	case 'save_transaction':
		echo $Master->save_transaction();
	break;
	case 'delete_transaction':
		echo $Master->delete_transaction();
	break;
	case 'update_status':
		echo $Master->update_status();
	break;
	case 'search_products':
		echo $Master->search_products();
	break;
	case 'save_direct_sale':
		echo $Master->save_direct_sale();
	break;
	case 'delete_direct_sale':
		echo $Master->delete_direct_sale();
	break;
	case 'create_backup':
		echo $Master->create_backup();
	break;
	case 'delete_backup':
		echo $Master->delete_backup();
	break;
	case 'save_settings':
		echo $Master->save_settings();
	break;
	case 'get_client_balance':
		echo $Master->get_client_balance();
	break;
	case 'save_expense':
        echo $Master->save_expense();
    break;
    case 'delete_expense':
        echo $Master->delete_expense();
    break;
	case 'save_attendance':
    echo $Master->save_attendance();
	break;
	case 'save_advance':
		echo $Master->save_advance();
	break;
	case 'delete_advance':
		echo $Master->delete_advance();
	break;
	case 'update_salary_rate':
		echo $Master->update_salary_rate();
	break;
	case 'delete_salary_history':
		echo $Master->delete_salary_history();
	break;
	case 'update_history_entry':
		echo $Master->update_history_entry();
	break;
	case 'save_multi_transaction':
    if(!isset($_POST['client_name']) || empty($_POST['client_name'])){
        $resp['status'] = 'failed';
        $resp['msg'] = 'Client not selected';
        echo json_encode($resp);
        exit;
    }
    $client_id = $conn->real_escape_string($_POST['client_name']);
    $items_json = $_POST['items'] ?? '[]';
    $items = json_decode($items_json, true);
    if(!is_array($items) || count($items) == 0){
        $resp['status'] = 'failed';
        $resp['msg'] = 'No items to save';
        echo json_encode($resp);
        exit;
    }

    global $_settings;
    $user_id = $_settings->userdata('id');

    $saved_count = 0;
    $tid_list = [];

    $prefix = date("Ymd"); // Same as original

    foreach($items as $item){
        if(empty($item['job_id']) || empty($item['mechanic_id']) || empty($item['item']) || empty($item['fault'])){
            continue;
        }

        $job_id = $conn->real_escape_string($item['job_id']);
        $mechanic_id = $conn->real_escape_string($item['mechanic_id']);
        $item_name = $conn->real_escape_string($item['item']);
        $fault = $conn->real_escape_string($item['fault']);
        $uniq_id = $conn->real_escape_string($item['uniq_id'] ?? '');
        $remark = $conn->real_escape_string($item['remark'] ?? '');

        // Unique code generate - same logic as original
        $code_num = 1;
        do {
            $code = $prefix . sprintf("%02d", $code_num);
            $check = $conn->query("SELECT id FROM transaction_list WHERE code = '$code' LIMIT 1");
            $code_num++;
        } while($check->num_rows > 0);

        $sql = "INSERT INTO transaction_list SET
                client_name = '$client_id',
                mechanic_id = '$mechanic_id',
                job_id = '$job_id',
                code = '$code',
                item = '$item_name',
                fault = '$fault',
                uniq_id = '$uniq_id',
                remark = '$remark',
                user_id = '$user_id',
                amount = '0',
                status = '0',
                date_created = NOW()";

        if($conn->query($sql)){
            $saved_count++;
            $tid_list[] = $conn->insert_id;
        }
    }

    if($saved_count > 0){
        $resp['status'] = 'success';
        $resp['count'] = $saved_count;
        $resp['tids'] = $tid_list;
    } else {
        $resp['status'] = 'failed';
        $resp['msg'] = 'No transaction was saved. Please check data.';
    }
    echo json_encode($resp);
    exit;
    break;
	case 'delete_transaction_image':
		echo $Master->delete_transaction_image();
	break;
		
	default:
		// echo $sysset->index();
		break;
}