<?php 
if(isset($_GET['id'])){
    $user = $conn->query("SELECT * FROM users where id ='{$_GET['id']}' ");
    foreach($user->fetch_array() as $k =>$v){
        $meta[$k] = $v;
    }
}
?>
<?php if($_settings->chk_flashdata('success')): ?>
<script>
	alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>
<div class="card card-outline rounded-0 card-navy">
	<div class="card-body">
		<div class="container-fluid">
			<div id="msg"></div>
			<form action="" id="manage-user">	
				<input type="hidden" name="id" value="<?= isset($meta['id']) ? $meta['id'] : '' ?>">
				<div class="form-group">
					<label for="name">First Name</label>
					<input type="text" name="firstname" id="firstname" class="form-control" value="<?php echo isset($meta['firstname']) ? $meta['firstname']: '' ?>" required>
				</div>
				<div class="form-group">
					<label for="name">Last Name</label>
					<input type="text" name="lastname" id="lastname" class="form-control" value="<?php echo isset($meta['lastname']) ? $meta['lastname']: '' ?>" required>
				</div>
				<div class="form-group">
					<label for="username">Username</label>
					<input type="text" name="username" id="username" class="form-control" value="<?php echo isset($meta['username']) ? $meta['username']: '' ?>" required  autocomplete="off">
				</div>
				<div class="form-group">
					<label for="password"><?php echo isset($id) ? "New" : "" ?> Password</label>
					<div class="input-group">
						<input type="password" name="password" id="password" class="form-control" value="" autocomplete="off" <?php echo isset($meta['id']) ? "" : 'required' ?>>
						<div class="input-group-append">
							<button class="btn btn-outline-secondary" type="button" id="toggle-password">
								<i class="fa fa-eye"></i>
							</button>
						</div>
					</div>
					<?php if(isset($_GET['id'])): ?>
					<small class="text-info"><i>Leave this blank if you don't want to change the password.</i></small>
					<?php endif; ?>
				</div>
                
                <div class="form-group">
					<label for="type">User Type</label>
					<select name="type" id="type" class="custom-select" required>
						<option value="1" <?php echo isset($meta['type']) && $meta['type'] == 1 ? 'selected': '' ?>>Administrator</option>
						<option value="2" <?php echo isset($meta['type']) && $meta['type'] == 2 ? 'selected': '' ?>>Staff/Mechanic</option>
					</select>
				</div>

                <div class="form-group" id="mechanic_selection" style="display:none">
                    <label for="mechanic_id">Link to Mechanic Profile</label>
                    <select name="mechanic_id" id="mechanic_id" class="custom-select shadow-sm border-primary">
                        <option value="" disabled <?php echo !isset($meta['mechanic_id']) ? 'selected' : '' ?>>Select Mechanic</option>
                        <?php 
                        $mechanics = $conn->query("SELECT id, CONCAT(firstname,' ',middlename,' ',lastname) as name FROM mechanic_list WHERE status = 1 ORDER BY name ASC");
                        while($row = $mechanics->fetch_assoc()):
                        ?>
                        <option value="<?= $row['id'] ?>" <?= isset($meta['mechanic_id']) && $meta['mechanic_id'] == $row['id'] ? 'selected' : '' ?>><?= $row['name'] ?></option>
                        <?php endwhile; ?>
                    </select>
                    <small class="text-muted text-italic">Attendance lagane ke liye staff ko uski profile se link karna zaroori hai.</small>
                </div>

				<div class="form-group">
					<label for="" class="control-label">Avatar</label>
					<div class="custom-file">
		              <input type="file" class="custom-file-input rounded-circle" id="customFile" name="img" onchange="displayImg(this,$(this))" accept="image/png, image/jpeg">
		              <label class="custom-file-label" for="customFile">Choose file</label>
		            </div>
				</div>
				<div class="form-group d-flex justify-content-center">
					<img src="<?php echo validate_image(isset($meta['avatar']) ? $meta['avatar'] :'') ?>" alt="" id="cimg" class="img-fluid img-thumbnail">
				</div>
			</form>
		</div>
	</div>
	<div class="card-footer">
			<div class="col-md-12">
				<div class="row">
					<button class="btn btn-sm btn-primary" form="manage-user">Update Account</button>
				</div>
			</div>
		</div>
</div>
<style>
	img#cimg{
		height: 15vh;
		width: 15vh;
		object-fit: cover;
		border-radius: 100% 100%;
	}
</style>
<script>
	function displayImg(input,_this) {
	    if (input.files && input.files[0]) {
	        var reader = new FileReader();
	        reader.onload = function (e) {
	        	$('#cimg').attr('src', e.target.result);
	        }

	        reader.readAsDataURL(input.files[0]);
	    }
	}

    $(function(){
        // Check user type on load
        if($('#type').val() == 2){
            $('#mechanic_selection').show();
            $('#mechanic_id').attr('required',true);
        }

        // Handle Change
        $('#type').change(function(){
            if($(this).val() == 2){
                $('#mechanic_selection').slideDown();
                $('#mechanic_id').attr('required',true);
            } else {
                $('#mechanic_selection').slideUp();
                $('#mechanic_id').val('').removeAttr('required');
            }
        });

        // Toggle Password Visibility
        $('#toggle-password').click(function(){
            const passwordField = $('#password');
            const type = passwordField.attr('type') === 'password' ? 'text' : 'password';
            passwordField.attr('type', type);
            $(this).find('i').toggleClass('fa-eye fa-eye-slash');
        });

        // Form Submit
        $('#manage-user').submit(function(e){
            e.preventDefault();
            start_loader()
            $.ajax({
                url:_base_url_+'classes/Users.php?f=save',
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                success:function(resp){
                    if(resp ==1){
                        location.href='./?page=user/list'
                    }else if(resp == 3){
                        $('#msg').html('<div class="alert alert-danger">Username already exist</div>')
                        end_loader()
                    }else{
                        $('#msg').html('<div class="alert alert-danger">An error occurred</div>')
                        end_loader()
                    }
                }
            })
        })
    })
</script>