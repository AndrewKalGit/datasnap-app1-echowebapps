'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';

export default function Dashboard() {
	const [columns, setColumns] = useState<
		{ name: string; patterns: string[]; matchValue?: string }[]
	>([]);
	const [newColName, setNewColName] = useState('');
	const [newPattern, setNewPattern] = useState('');
	const [image, setImage] = useState<File | null>(null);
	const [ocrText, setOcrText] = useState<string>('');
	const [loading, setLoading] = useState(false);
	const [filteredResults, setFilteredResults] = useState<string[][]>([]);

	// ---- Column Controls ----
	const addColumn = () => {
		if (!newColName.trim()) return;
		setColumns([...columns, { name: newColName, patterns: [] }]);
		setNewColName('');
	};

	const deleteColumn = (index: number) => {
		setColumns(columns.filter((_, i) => i !== index));
	};

	const addPattern = (index: number) => {
		if (!newPattern.trim()) return;
		const updated = [...columns];
		if (!updated[index].patterns.includes(newPattern)) {
			updated[index].patterns.push(newPattern);
		}
		setColumns(updated);
		setNewPattern('');
	};

	const removePattern = (colIdx: number, pattern: string) => {
		const updated = [...columns];
		updated[colIdx].patterns = updated[colIdx].patterns.filter(
			(p) => p !== pattern
		);
		setColumns(updated);
	};

	const updateMatchValue = (index: number, value: string) => {
		const updated = [...columns];
		updated[index].matchValue = value;
		setColumns(updated);
	};

	// ---- Upload Image ----
	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			setImage(e.target.files[0]);
		}
	};

	// ---- OCR Processing ----
	const processOCR = async () => {
		if (!image) return;
		setLoading(true);

		const worker = await createWorker('eng');
		const {
			data: { text },
		} = await worker.recognize(image);
		setOcrText(text);

		// Auto-run filtering for preview
		const textWords = text.split(/\s+/);
		const colMatches = columns.map((col) => {
			const matches: string[] = [];
			if (col.matchValue) {
				if (col.patterns.includes('startsWith')) {
					matches.push(
						...textWords.filter((word) =>
							word.startsWith(col.matchValue as string)
						)
					);
				}
				if (col.patterns.includes('endsWith')) {
					matches.push(
						...textWords.filter((word) =>
							word.endsWith(col.matchValue as string)
						)
					);
				}
				if (col.patterns.includes('contains')) {
					matches.push(
						...textWords.filter((word) =>
							word.includes(col.matchValue as string)
						)
					);
				}
			}
			return matches;
		});
		const maxRows = Math.max(...colMatches.map((m) => m.length), 0);
		const rows: string[][] = [];
		for (let i = 0; i < maxRows; i++) {
			rows.push(colMatches.map((col) => col[i] || ''));
		}
		setFilteredResults(rows);

		setLoading(false);
	};

	// ---- Export to Excel ----
	const exportToExcel = () => {
		if (!ocrText) return;

		const worksheet = XLSX.utils.aoa_to_sheet([
			columns.map((c) => c.name), // headers
			...filteredResults,
		]);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
		XLSX.writeFile(workbook, 'ocr_results.xlsx');
	};

	return (
		<div className='p-6 space-y-6'>
			<h1 className='text-xl font-bold'>Data-Snap Dashboard</h1>

			{/* Step 1: Upload Highlight */}
			<div className='border-4 border-dashed border-blue-500 bg-blue-50 p-6 text-center rounded-lg'>
				<h2 className='text-lg font-semibold mb-2'>Step 1: Upload Image</h2>
				<input
					type='file'
					accept='image/*'
					onChange={handleImageUpload}
					className='block mx-auto bg-blue-200 p-20 rounded-lg cursor-pointer'
				/>
				<button
					onClick={processOCR}
					disabled={!image || loading}
					className='bg-purple-500 text-white px-4 py-2 mt-3 rounded'>
					{loading ? 'Processing...' : 'Run OCR'}
				</button>
			</div>

			{/* Step 2: Configure Columns */}
			<div>
				<h2 className='text-lg font-semibold'>Step 2: Define Columns</h2>
				<div className='space-x-2 mt-2'>
					<input
						type='text'
						placeholder='Column name'
						value={newColName}
						onChange={(e) => setNewColName(e.target.value)}
						className='border p-1'
					/>
					<button
						onClick={addColumn}
						className='bg-blue-500 text-white px-2 py-1 rounded'>
						Add Column
					</button>
				</div>

				{columns.map((col, idx) => (
					<div key={idx} className='border p-3 my-2 rounded'>
						<div className='flex justify-between items-center'>
							<h2 className='font-semibold'>{col.name}</h2>
							<button
								onClick={() => deleteColumn(idx)}
								className='text-red-600 text-sm'>
								Delete
							</button>
						</div>

						<div className='flex space-x-2 mt-2'>
							<select
								value={newPattern}
								onChange={(e) => setNewPattern(e.target.value)}
								className='border p-1'>
								<option value=''>Select pattern</option>
								<option value='startsWith'>Starts With</option>
								<option value='endsWith'>Ends With</option>
								<option value='contains'>Contains</option>
							</select>
							<button
								onClick={() => addPattern(idx)}
								className='bg-green-500 text-white px-2 py-1 rounded'>
								+ Add Pattern
							</button>
							<input
								type='text'
								placeholder='Match value'
								value={col.matchValue || ''}
								onChange={(e) => updateMatchValue(idx, e.target.value)}
								className='border p-1'
							/>
						</div>

						<div className='mt-2 text-sm text-gray-600'>
							{col.patterns.length > 0 ? (
								<ul className='list-disc ml-5'>
									{col.patterns.map((p) => (
										<li key={p} className='flex justify-between items-center'>
											<span>{p}</span>
											<button
												onClick={() => removePattern(idx, p)}
												className='text-xs text-red-600 ml-2'>
												remove
											</button>
										</li>
									))}
								</ul>
							) : (
								<span>No patterns</span>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Step 3: Review Extracted vs Filtered */}
			{ocrText && (
				<div className='grid grid-cols-2 gap-6 mt-6'>
					<div className='border p-3 rounded bg-gray-50'>
						<h2 className='font-semibold'>Extracted Text</h2>
						<pre className='whitespace-pre-wrap text-sm'>{ocrText}</pre>
					</div>
					<div className='border p-3 rounded bg-green-50'>
						<h2 className='font-semibold'>Filtered Text (Excel Preview)</h2>
						<table className='text-sm border-collapse border border-gray-300'>
							<thead>
								<tr>
									{columns.map((c) => (
										<th
											key={c.name}
											className='border border-gray-300 px-2 py-1'>
											{c.name}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{filteredResults.map((row, i) => (
									<tr key={i}>
										{row.map((cell, j) => (
											<td key={j} className='border border-gray-300 px-2 py-1'>
												{cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Export */}
			<button
				onClick={exportToExcel}
				disabled={!ocrText}
				className='bg-orange-500 text-white px-4 py-2 rounded mt-4'>
				Export to Excel
			</button>
		</div>
	);
}
