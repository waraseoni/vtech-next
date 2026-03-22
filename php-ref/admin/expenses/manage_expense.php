<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `expense_list` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){
            $$k=$v;
        }
    }
}
?>
<div class="container-fluid">
	<form action="" id="expense-form">
		<input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
		<div class="form-group">
			<label for="category" class="control-label">Expense Category</label>
			<select name="category" id="category" class="form-control form-control-sm rounded-0" required>
                <option value="" disabled <?php echo !isset($category) ? "selected" : "" ?>>Select Category</option>
                <option <?php echo isset($category) && $category == 'Shop Rent' ? "selected" : "" ?>>Shop Rent</option>
                <option <?php echo isset($category) && $category == 'Electricity Bill' ? "selected" : "" ?>>Electricity Bill</option>
                <option <?php echo isset($category) && $category == 'Spare Parts Purchase' ? "selected" : "" ?>>Spare Parts Purchase</option>
                <option <?php echo isset($category) && $category == 'Salary' ? "selected" : "" ?>>Salary</option>
                <option <?php echo isset($category) && $category == 'Tea & Snacks' ? "selected" : "" ?>>Tea & Snacks</option>
                <option <?php echo isset($category) && $category == 'Others' ? "selected" : "" ?>>Others</option>
            </select>
		</div>
		<div class="form-group">
			<label for="amount" class="control-label">Amount (₹)</label>
			<input type="number" step="any" name="amount" id="amount" class="form-control form-control-sm rounded-0 text-right" value="<?php echo isset($amount) ? $amount : ''; ?>" required/>
		</div>
		<div class="form-group">
			<label for="remarks" class="control-label">Remarks / Details</label>
			<textarea rows="3" name="remarks" id="remarks" class="form-control form-control-sm rounded-0" placeholder="Write details about this expense..."><?php echo isset($remarks) ? $remarks : ''; ?></textarea>
		</div>
	</form>
</div>

<script>
	$(document).ready(function(){
		$('#expense-form').submit(function(e){
			e.preventDefault();
            var _this = $(this)
			 $('.err-msg').remove();
			start_loader();
			$.ajax({
				url:_base_url_+"classes/Master.php?f=save_expense",
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
						location.reload();
					}else if(resp.status == 'failed' && !!resp.msg){
                        var el = $('<div>')
                            el.addClass("alert alert-danger err-msg").text(resp.msg)
                            _this.prepend(el)
                            el.show('slow')
                            $("html, body, .modal").scrollTop(0);
                            end_loader()
                    }else{
						alert_toast("An error occured",'error');
						end_loader();
                        console.log(resp)
					}
				}
			})
		})
	})
</script>