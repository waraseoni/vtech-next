<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `inventory_list` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
}
$p_id = $_GET['product_id'] ?? $product_id;
?>
<div class="container-fluid">
	<form action="" id="inventory-form">
		<input type="hidden" name ="id" value="<?php echo isset($id) ? $id : '' ?>">
		<input type="hidden" name ="product_id" value="<?php echo $p_id ?>">
		
		<div class="form-group">
			<label for="quantity" class="control-label">Stock Quantity</label>
			<input type="number" step="any" name="quantity" id="quantity" class="form-control rounded-0 text-right" value="<?php echo isset($quantity) ? $quantity : ''; ?>" placeholder="Enter number of items" required/>
		</div>
		<div class="form-group">
			<label for="place" class="control-label">Place/Location</label>
			<input type="text" name="place" id="place" class="form-control rounded-0" value="<?php echo isset($place) ? $place : ''; ?>" placeholder="Enter Location of items">
		</div>
		<div class="form-group">
			<label for="stock_date" class="control-label">Stock-In Date</label>
			<input type="date" name="stock_date" id="stock_date" class="form-control rounded-0" value="<?php echo isset($stock_date) ? date("Y-m-d", strtotime($stock_date)) : date("Y-m-d"); ?>" max="<?= date("Y-m-d") ?>" required/>
		</div>
	</form>
</div>
<script>
	$(document).ready(function(){
		$('#inventory-form').submit(function(e){
			e.preventDefault();
            var _this = $(this)
			$('.err-msg').remove();
			start_loader();
			$.ajax({
				url:_base_url_+"classes/Master.php?f=save_inventory",
				data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
				error:err=>{
					console.log(err)
					alert_toast("An error occured",'error');
					end_loader();
				},
				success:function(resp){
					if(typeof resp =='object' && resp.status == 'success'){
						location.reload()
					}else{
                        alert_toast(resp.msg || "An error occurred",'error');
                    }
                    end_loader();
				}
			})
		})
	})
</script>