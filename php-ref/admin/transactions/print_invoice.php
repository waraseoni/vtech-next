<?php 
require_once('../../config.php'); 

if(isset($_GET['id'])){
    $id = $_GET['id'];
    $qry = $conn->query("SELECT t.*, CONCAT(c.firstname,' ',c.lastname) as client_full_name, c.contact, c.address 
                         FROM `transaction_list` t 
                         INNER JOIN client_list c ON t.client_name = c.id 
                         WHERE t.id = '{$id}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k = $v; }
    }
}

$status_text_map = [0 => "Pending", 1 => "On-Progress", 2 => "Done", 3 => "Paid", 4 => "Cancelled", 5 => "Delivered"];
$current_status = isset($status) ? ($status_text_map[$status] ?? "Pending") : "Pending";
?>

<!DOCTYPE html>
<html>
<head>
    <title>Professional Invoice - V-Tech</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; background: #f4f7f6; color: #333; }
        .invoice-box { max-width: 850px; margin: auto; padding: 30px; border: 1px solid #ddd; background: #fff; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        
        /* Classic Blue Header Style */
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0056b3; padding-bottom: 20px; margin-bottom: 20px; }
        .shop-info h2 { margin: 0; color: #0056b3; font-size: 28px; text-transform: uppercase; }
        .shop-info p { margin: 5px 0; font-size: 14px; }
        .invoice-title { text-align: right; }
        .invoice-title h1 { margin: 0; color: #ccc; font-size: 40px; }

        /* Control Panel */
        .no-print-zone { background: #343a40; color: white; padding: 15px; margin-bottom: 20px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; }
        .btn { padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .btn-add { background: #007bff; color: white; margin-top: 10px; }
        .btn-print { background: #28a745; color: white; font-size: 16px; }

        /* Table */
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        table th { background: #0056b3; color: white; padding: 12px; text-align: left; border: 1px solid #004494; }
        table td { padding: 10px; border: 1px solid #eee; }
        .editable:hover { background: #fff9c4; outline: 1px dashed #ffc107; }
        
        input[type="number"] { width: 70px; padding: 5px; border: 1px solid #ddd; }
        .remove-row { color: #d9534f; cursor: pointer; font-weight: bold; font-size: 12px; }

        .total-area { text-align: right; margin-top: 20px; line-height: 1.8; }
        .grand-total { font-size: 22px; font-weight: bold; color: #0056b3; border-top: 2px solid #0056b3; display: inline-block; padding-top: 5px; }

        @media print {
            .no-print-zone, .remove-row, .btn-add, .no-print { display: none !important; }
            body { background: white; padding: 0; }
            .invoice-box { border: none; box-shadow: none; width: 100%; max-width: 100%; }
            input { border: none !important; background: transparent !important; pointer-events: none; }
        }
    </style>
</head>
<body>

<div class="no-print-zone">
    <div>
        <label><input type="checkbox" id="tax_toggle" onchange="calculate()"> 18% GST Apply Karein</label>
    </div>
    <div style="font-size: 13px;">* Click on any text to Edit | Add new rows for extra items</div>
    <button onclick="window.print()" class="btn btn-print">PRINT INVOICE</button>
</div>

<div class="invoice-box">
    <div class="header">
        <div class="shop-info">
            <h2 class="editable" contenteditable="true">V-Technologies</h2>
            <p class="editable" contenteditable="true">F4, Hotel Plaza ( now Madhushala ), Beside Jayanyi Complex, Marhatal | Jabalpur (M.P.)</p>
            <p class="editable" contenteditable="true">Contact: +91 9179105875 | </p>
        </div>
        <div class="invoice-title">
            <h1><?php echo (isset($status) && $status == 3) ? 'INVOICE' : 'ESTIMATE'; ?></h1>
            <p>Date: <?php echo date("d-M-Y") ?></p>
            <p>Status: <span class="editable" contenteditable="true"><?php echo $current_status ?></span></p>
        </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div>
            <strong style="color:#0056b3">BILL TO:</strong><br>
            <span class="editable" contenteditable="true"><strong><?php echo $client_full_name ?></strong></span><br>
            <span class="editable" contenteditable="true"><?php echo $contact ?></span><br>
            <span class="editable" contenteditable="true"><?php echo $address ?></span>
        </div>
        <div style="text-align: right;">
            <strong>Job ID:</strong> #<?php echo $id ?><br>
            <strong>Tracking:</strong> <?php echo $job_id ?><br>
			<strong>Code:</strong> <?php echo $code ?>
        </div>
    </div>

    <table id="invoiceTable">
        <thead>
            <tr>
                <th>Item / Service Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price (₹)</th>
                <th style="text-align: right;">Total (₹)</th>
                <th class="no-print" style="width: 50px;"></th>
            </tr>
        </thead>
        <tbody>
            <?php 
            $items = $conn->query("
                (SELECT s.name, ts.price, 1 as qty FROM transaction_services ts INNER JOIN service_list s ON ts.service_id = s.id WHERE ts.transaction_id = '$id')
                UNION
                (SELECT p.name, tp.price, tp.qty FROM transaction_products tp INNER JOIN product_list p ON tp.product_id = p.id WHERE tp.transaction_id = '$id')
            ");
            while($row = $items->fetch_assoc()):
            ?>
            <tr>
                <td class="editable" contenteditable="true"><?php echo $row['name'] ?></td>
                <td style="text-align: center;"><input type="number" class="qty" value="<?php echo $row['qty'] ?>" oninput="calculate()"></td>
                <td style="text-align: right;"><input type="number" class="rate" value="<?php echo $row['price'] ?>" oninput="calculate()"></td>
                <td style="text-align: right;" class="row-total">0.00</td>
                <td class="no-print"><span class="remove-row" onclick="this.closest('tr').remove(); calculate();">✖</span></td>
            </tr>
            <?php endwhile; ?>
        </tbody>
    </table>

    <button class="btn btn-add" onclick="addRow()">+ Add New Item / Service</button>

    <div class="total-area">
        <p>Sub-Total: ₹ <span id="sub_total">0.00</span></p>
        <p id="tax_row" style="display:none;">GST (18%): ₹ <span id="tax_val">0.00</span></p>
        <p class="grand-total">Grand Total: ₹ <span id="grand_total">0.00</span></p>
    </div>

    <div style="margin-top: 50px;">
        <p><strong>Terms & Conditions:</strong></p>
        <p class="editable" contenteditable="true" style="font-size: 12px; color: #666;">
            1. No warranty on physical or liquid damage. <br>
            2. Warranty is valid only on the parts replaced. <br>
            3. Items must be collected within 10 days after completion.
        </p>
    </div>
</div>

<script>
function addRow() {
    var table = document.getElementById("invoiceTable").getElementsByTagName('tbody')[0];
    var row = table.insertRow();
    row.innerHTML = `
        <td class="editable" contenteditable="true">New Service/Part Name</td>
        <td style="text-align: center;"><input type="number" class="qty" value="1" oninput="calculate()"></td>
        <td style="text-align: right;"><input type="number" class="rate" value="0" oninput="calculate()"></td>
        <td style="text-align: right;" class="row-total">0.00</td>
        <td class="no-print"><span class="remove-row" onclick="this.closest('tr').remove(); calculate();">✖</span></td>
    `;
    calculate();
}

function calculate() {
    let sub = 0;
    document.querySelectorAll("#invoiceTable tbody tr").forEach(row => {
        let q = row.querySelector(".qty").value || 0;
        let r = row.querySelector(".rate").value || 0;
        let t = q * r;
        row.querySelector(".row-total").innerText = t.toFixed(2);
        sub += t;
    });

    document.getElementById("sub_total").innerText = sub.toFixed(2);
    let taxChecked = document.getElementById("tax_toggle").checked;
    let final = sub;

    if(taxChecked) {
        let tax = sub * 0.18;
        document.getElementById("tax_val").innerText = tax.toFixed(2);
        document.getElementById("tax_row").style.display = "block";
        final = sub + tax;
    } else {
        document.getElementById("tax_row").style.display = "none";
    }
    document.getElementById("grand_total").innerText = final.toFixed(2);
}

window.onload = calculate;
</script>
</body>
</html>