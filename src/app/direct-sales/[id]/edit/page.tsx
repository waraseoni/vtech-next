"use client";
import { useParams } from 'next/navigation';
import SaleForm from '../../components/SaleForm';

export default function EditSalePage() {
  const params = useParams();
  const saleId = Number(params.id);
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Direct Sale</h1>
        <SaleForm mode="edit" saleId={saleId} />
      </div>
    </div>
  );
}