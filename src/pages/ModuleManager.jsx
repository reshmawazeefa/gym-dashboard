import React, { useMemo, useState, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Box, CalendarDays, CreditCard, Download, Edit, Plus, Search, Tag, Trash, TriangleAlert, Users, Eye, X } from "lucide-react";
import toast from "react-hot-toast";
import { moduleDefinitions } from "../data/moduleDefinitions";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";
import { isSubscriptionActive } from "../utils/subscriptionStatus";
import AttendanceStatus from "../components/AttendanceStatus";
import StatusBadge from "../components/StatusBadge";
import AdminAttendance from "../components/AdminAttendance";
import AdminEquipments from "../components/AdminEquipments";
import AdminFacilities from "../components/AdminFacilities";
import AdminNotifications from "../components/AdminNotifications";
import AdminWorkouts from "../components/AdminWorkouts";
import Payroll from "../components/Payroll";
import FacilityMaintenance from "../components/FacilityMaintenance";
import TrainerSchedule from "./TrainerSchedule";
import NutritionModule from "./NutritionModule";
import {
  getApiError,
  getBillingPlans,
  getCurrentSubscription,
  cancelSubscription,
  renewSubscription,
  upgradeSubscription,
  getPaymentHistory,
  getPaymentOrders,
  getPaymentOrder,
  createPaymentRefund,
  subscribeToBillingPlan,
  createPaymentCheckout,
  verifyPayment,
  getMembershipPlans,
  subscribeToPlan,
  unwrapList,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getTenantUsers,
  createGymStaff,
  updateTenantUser,
  deleteUser,
  unwrapObject,
} from "../services/api";

function getStoredRecords(definition) {
  const stored = JSON.parse(localStorage.getItem(definition.storageKey));
  if (Array.isArray(stored) && stored.length) return stored;

  localStorage.setItem(definition.storageKey, JSON.stringify(definition.seed || []));
  return definition.seed || [];
}

function getEmptyForm(fields) {
  return fields.reduce((form, field) => {
    form[field.name] = field.type === "select" ? field.options[0] : "";
    return form;
  }, {});
}

function getDisplayFields(definition) {
  return definition.fields.slice(0, 5);
}

function idOf(item) {
  return item?.id || item?._id || item?.planId || item?.userId || "";
}

function normalizePlan(plan = {}) {
  return {
    ...plan,
    id: idOf(plan) || plan.name,
    name: plan.name || plan.planName || plan.title || "Unnamed plan",
  };
}

const PLAN_TYPE_DURATIONS = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
};

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPlanDurationDays(plan) {
  const duration = Number(plan?.duration ?? plan?.durationDays ?? plan?.validityDays);
  if (Number.isFinite(duration) && duration > 0) return duration;

  return PLAN_TYPE_DURATIONS[String(plan?.planType || "").toUpperCase()] || 0;
}

function getSubscriptionEndDate(plan, startDate) {
  const durationDays = getPlanDurationDays(plan);
  if (!startDate || !durationDays) return "";

  const [year, month, day] = String(startDate).split("-").map(Number);
  if (!year || !month || !day) return "";

  const endDate = new Date(year, month - 1, day);
  endDate.setDate(endDate.getDate() + durationDays);

  return formatDateInput(endDate);
}

function updateSubscriptionDateFields(currentForm, fieldName, value, plans) {
  const nextForm = { ...currentForm, [fieldName]: value };

  if (fieldName === "plan" || fieldName === "startDate") {
    const selectedPlan = plans.find((plan) => String(idOf(plan)) === String(nextForm.plan));
    nextForm.endDate = getSubscriptionEndDate(selectedPlan, nextForm.startDate);
  }

  return nextForm;
}

function renderField(field, value, setForm, moduleKey, members, plans) {
  const baseClass =
    "w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const isSubscriptionDateSource = moduleKey === "subscriptions" && (field.name === "plan" || field.name === "startDate");
  const isSubscriptionEndDate = moduleKey === "subscriptions" && field.name === "endDate";
  const updateField = (fieldValue) =>
    setForm((form) =>
      isSubscriptionDateSource
        ? updateSubscriptionDateFields(form, field.name, fieldValue, plans)
        : { ...form, [field.name]: fieldValue }
    );

  if (field.type === "select") {
    if (moduleKey === "subscriptions" && field.name === "member") {
      return (
        <select
          className={baseClass}
          value={value}
          onChange={(event) => updateField(event.target.value)}
        >
          <option value="">Select Member</option>
          {members.map((member) => (
            <option key={idOf(member)} value={idOf(member)}>
              {member.name}
            </option>
          ))}
        </select>
      );
    }
    if (moduleKey === "subscriptions" && field.name === "plan") {
      return (
        <select
          className={baseClass}
          value={value}
          onChange={(event) => updateField(event.target.value)}
        >
          <option value="">Select Plan</option>
          {plans.map((plan) => (
            <option key={idOf(plan)} value={idOf(plan)}>
              {plan.name}
            </option>
          ))}
        </select>
      );
    }
    return (
      <select
        className={baseClass}
        value={value}
        onChange={(event) => updateField(event.target.value)}
      >
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${baseClass} min-h-24 resize-y`}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => updateField(event.target.value)}
      />
    );
  }

  return (
    <input
      className={`${baseClass} ${isSubscriptionEndDate ? "bg-gray-100 text-gray-700" : ""}`}
      type={field.type}
      placeholder={field.placeholder}
      value={value}
      readOnly={isSubscriptionEndDate}
      onChange={(event) => updateField(event.target.value)}
    />
  );
}

export default function ModuleManager() {
  const { moduleKey } = useParams();
  const { user } = useAuth();
  const isValidModule = Boolean(moduleDefinitions[moduleKey]);

  if (!isValidModule) {
    return <Navigate to="/" replace />;
  }

  if (moduleKey === "products") {
    return <ProductModule key={moduleKey} user={user} />;
  }

  if (moduleKey === "staff") {
    return <StaffModule key={moduleKey} user={user} />;
  }

  if (moduleKey === "workouts") {
    return <AdminWorkouts />;
  }

  if (moduleKey === "payroll") {
    return <Payroll key={moduleKey} user={user} />;
  }

  if (moduleKey === "nutrition") {
    return <NutritionModule key={moduleKey} user={user} />;
  }

  if (moduleKey === "classes") {
    return <TrainerSchedule />;
  }

  if (moduleKey === "facilities") {
    return <AdminFacilities />;
  }

  if (moduleKey === "facility-maintenance") {
    return <FacilityMaintenance />;
  }

  if (moduleKey === "equipments") {
    return <AdminEquipments key={moduleKey} />;
  }

  if (moduleKey === "notifications") {
    return <AdminNotifications />;
  }

  if (moduleKey === "subscriptions") {
    return <OwnerSubscriptionsModule user={user} />;
  }

  return (
    <ModuleWorkspace
      key={moduleKey}
      moduleKey={moduleKey}
      definition={moduleDefinitions[moduleKey]}
    />
  );
}

function ProductFormFields({ productForm, setProductForm, categoryOptions, formatDisplayValue }) {
  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white";
  const labelClass = "grid gap-1 text-xs font-semibold text-[#334155]";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>
        Product Name <input className={fieldClass} type="text" value={productForm.name} onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))} placeholder="Whey Protein" />
      </label>
      <label className={labelClass}>
        Category <select className={fieldClass} value={productForm.categoryId} onChange={(event) => setProductForm((form) => ({ ...form, categoryId: event.target.value }))}>
          <option value="">Select Category</option>
          {categoryOptions.map((option) => <option key={option.value} value={option.value}>{formatDisplayValue(option.label)}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Brand <input className={fieldClass} type="text" value={productForm.brand} onChange={(event) => setProductForm((form) => ({ ...form, brand: event.target.value }))} placeholder="Optimum Nutrition" />
      </label>
      <label className={labelClass}>
        SKU <input className={fieldClass} type="text" value={productForm.sku} onChange={(event) => setProductForm((form) => ({ ...form, sku: event.target.value }))} placeholder="WHEY-001" />
      </label>
      <label className={labelClass}>
        Barcode <input className={fieldClass} type="text" value={productForm.barcode} onChange={(event) => setProductForm((form) => ({ ...form, barcode: event.target.value }))} placeholder="123456789" />
      </label>
      <label className={labelClass}>
        Regular Price <span className="text-red-500">*</span> <input className={fieldClass} type="number" value={productForm.price} onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))} placeholder="4500" />
      </label>
      <label className={labelClass}>
        Sale Price <input className={fieldClass} type="number" value={productForm.salePrice} onChange={(event) => setProductForm((form) => ({ ...form, salePrice: event.target.value }))} placeholder="3999" />
      </label>
      <label className={labelClass}>
        Stock Quantity <span className="text-red-500">*</span> <input className={fieldClass} type="number" value={productForm.stockQuantity} onChange={(event) => setProductForm((form) => ({ ...form, stockQuantity: event.target.value }))} placeholder="20" />
      </label>
      <label className={labelClass}>
        Low Stock Threshold <input className={fieldClass} type="number" value={productForm.lowStockThreshold} onChange={(event) => setProductForm((form) => ({ ...form, lowStockThreshold: event.target.value }))} placeholder="5" />
      </label>
      <label className={labelClass}>
        Image URL <input className={fieldClass} type="text" value={productForm.image} onChange={(event) => setProductForm((form) => ({ ...form, image: event.target.value }))} placeholder="https://example.com/image.jpg" />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Description <textarea className="min-h-24 w-full resize-y rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white" value={productForm.description} onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))} placeholder="Premium whey protein isolate" />
      </label>
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#334155] sm:col-span-2">
        <input type="checkbox" checked={productForm.isActive} onChange={(event) => setProductForm((form) => ({ ...form, isActive: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 accent-[#0D8252] focus:ring-2 focus:ring-[#0D8252]/20" />
        Active in store catalog
      </label>
    </div>
  );
}

function ProductModule({ user }) {
  const [activeTab, setActiveTab] = useState("products");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    sku: "",
    barcode: "",
    brand: "",
    price: "",
    salePrice: "",
    stockQuantity: "",
    lowStockThreshold: "",
    image: "",
    isActive: true,
  });
  const [categoryEditId, setCategoryEditId] = useState(null);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productEditId, setProductEditId] = useState(null);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (!categoryEditId && !isCategoryModalOpen && !productEditId && !isProductModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [categoryEditId, isCategoryModalOpen, productEditId, isProductModalOpen]);

  const closeCategoryModal = () => {
    setCategoryEditId(null);
    setCategoryModalOpen(false);
    setCategoryForm({ name: "", description: "" });
  };

  const openAddCategoryModal = () => {
    setActiveTab("categories");
    setCategoryEditId(null);
    setCategoryForm({ name: "", description: "" });
    setCategoryModalOpen(true);
  };

  const closeProductEditModal = () => {
    setProductEditId(null);
    setProductModalOpen(false);
    setProductForm({
      name: "",
      description: "",
      categoryId: "",
      sku: "",
      barcode: "",
      brand: "",
      price: "",
      salePrice: "",
      stockQuantity: "",
      lowStockThreshold: "",
      image: "",
      isActive: true,
    });
  };

  const openAddProductModal = () => {
    setActiveTab("products");
    setProductEditId(null);
    setProductForm({
      name: "",
      description: "",
      categoryId: "",
      sku: "",
      barcode: "",
      brand: "",
      price: "",
      salePrice: "",
      stockQuantity: "",
      lowStockThreshold: "",
      image: "",
      isActive: true,
    });
    setProductModalOpen(true);
  };

  const loadCategories = async () => {
    try {
      const response = await getAllCategories(user?.token);
      setCategories(unwrapList(response));
    } catch (error) {
      toast.error(getApiError(error, "Unable to load categories"));
    }
  };

  const loadProducts = async () => {
    try {
      const response = await getAllProducts(user?.token);
      setProducts(unwrapList(response));
    } catch (error) {
      toast.error(getApiError(error, "Unable to load products"));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const categoriesResponse = await getAllCategories(user?.token);
        const productsResponse = await getAllProducts(user?.token);
        setCategories(unwrapList(categoriesResponse));
        setProducts(unwrapList(productsResponse));
      } catch (error) {
        toast.error(getApiError(error, "Unable to load products and categories"));
      }
    };

    void loadData();
  }, [user?.token]);

  const formatDisplayValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") {
      if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
        return String(value);
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const categoryOptions = categories.map((category) => {
    if (category && typeof category === "object" && category.label && category.value) {
      return {
        label: formatDisplayValue(category.label),
        value: formatDisplayValue(category.value),
      };
    }

    return {
      label: formatDisplayValue(category.name || category.label || "Unnamed category"),
      value: formatDisplayValue(category.id || category._id || category.categoryId || category.value || ""),
    };
  });

  const getCategoryName = (categoryId) => {
    const category = categories.find(
      (cat) =>
        formatDisplayValue(cat.id || cat._id || cat.categoryId || cat.value) === formatDisplayValue(categoryId)
    );
    return formatDisplayValue(category?.name || category?.label || "-");
  };

  const isLowStock = (product) => {
    const stock = Number(product.stockQuantity);
    const threshold = Number(product.lowStockThreshold);
    return Number.isFinite(stock) && Number.isFinite(threshold) && stock <= threshold;
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.description.trim()) {
      toast.error("Category name and description are required");
      return;
    }

    try {
      if (categoryEditId) {
        await updateCategory(categoryEditId, categoryForm, user?.token);
        toast.success("Category updated successfully");
      } else {
        await createCategory(categoryForm, user?.token);
        toast.success("Category created successfully");
      }
      setCategoryForm({ name: "", description: "" });
      setCategoryEditId(null);
      setCategoryModalOpen(false);
      void loadCategories();
    } catch (error) {
      toast.error(getApiError(error, "Failed to save category"));
    }
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!productForm.categoryId) {
      toast.error("Category is required");
      return;
    }
    const price = Number(productForm.price);
    const salePrice = Number(productForm.salePrice);
    const stockQuantity = Number(productForm.stockQuantity);
    const lowStockThreshold = Number(productForm.lowStockThreshold);

    if (!Number.isFinite(price)) {
      toast.error("Price should be numeric");
      return;
    }
    if (!Number.isFinite(stockQuantity)) {
      toast.error("Stock Quantity should be numeric");
      return;
    }
    if (Number.isFinite(salePrice) && salePrice > price) {
      toast.error("Sale Price should not exceed actual Price");
      return;
    }

    const productPayload = {
      name: productForm.name,
      description: productForm.description,
      categoryId: productForm.categoryId,
      sku: productForm.sku,
      barcode: productForm.barcode,
      brand: productForm.brand,
      price,
      salePrice: Number.isFinite(salePrice) ? salePrice : undefined,
      stockQuantity,
      lowStockThreshold: Number.isFinite(lowStockThreshold) ? lowStockThreshold : undefined,
      image: productForm.image,
      isActive: Boolean(productForm.isActive),
    };

    try {
      if (productEditId) {
        await updateProduct(productEditId, productPayload, user?.token);
        toast.success("Product updated successfully");
      } else {
        await createProduct(productPayload, user?.token);
        toast.success("Product created successfully");
      }
      setProductForm({
        name: "",
        description: "",
        categoryId: "",
        sku: "",
        barcode: "",
        brand: "",
        price: "",
        salePrice: "",
        stockQuantity: "",
        lowStockThreshold: "",
        image: "",
        isActive: true,
      });
      setProductEditId(null);
      setProductModalOpen(false);
      void Promise.all([loadProducts(), loadCategories()]);
    } catch (error) {
      toast.error(getApiError(error, "Failed to save product"));
    }
  };

  const handleCategoryEdit = (category) => {
    setCategoryEditId(category.id || category._id);
    setCategoryModalOpen(true);
    setCategoryForm({
      name: category.name || "",
      description: category.description || "",
    });
  };

  const handleProductEdit = (product) => {
    setProductEditId(product.id || product._id);
    setProductModalOpen(true);
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      categoryId: product.categoryId || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      brand: product.brand || "",
      price: product.price || "",
      salePrice: product.salePrice || "",
      stockQuantity: product.stockQuantity || "",
      lowStockThreshold: product.lowStockThreshold || "",
      image: product.image || "",
      isActive: Boolean(product.isActive),
    });
  };

  const handleExportCsv = () => {
    const isProductsTab = activeTab === "products";
    const headers = isProductsTab
      ? ["Product Name", "SKU", "Barcode", "Category", "Brand", "Price", "Sale Price", "Stock Quantity", "Low Stock Threshold"]
      : ["Category Name", "Description"];
    const escapeCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = isProductsTab
      ? products.map((product) => [
          product.name,
          product.sku,
          product.barcode,
          getCategoryName(product.categoryId),
          product.brand,
          product.price,
          product.salePrice,
          product.stockQuantity,
          product.lowStockThreshold,
        ])
      : categories.map((category) => [category.name, category.description]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = isProductsTab ? "products.csv" : "categories.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${isProductsTab ? "Products" : "Categories"} exported successfully`);
  };

  const handleCategoryDelete = async (category) => {
    if (!confirm("Delete this category?")) return;
    try {
      await deleteCategory(category.id || category._id, user?.token);
      toast.success("Category deleted");
      void loadCategories();
    } catch (error) {
      toast.error(getApiError(error, "Failed to delete category"));
    }
  };

  const handleProductDelete = async (product) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(product.id || product._id, user?.token);
      toast.success("Product deleted");
      void loadProducts();
    } catch (error) {
      toast.error(getApiError(error, "Failed to delete product"));
    }
  };

  const filteredCategories = categories.filter((category) =>
    [category.name, category.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter((product) => {
    const textSearch = [product.name, product.brand, product.sku, product.barcode].join(" ").toLowerCase();
    const matchesSearch = textSearch.includes(search.toLowerCase());
    const matchesCategory = categoryFilter
      ? product.categoryId === categoryFilter
      : true;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = products.filter(isLowStock).length;

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6 space-y-5">
      <header className="flex flex-col gap-3 px-0.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">Product &amp; Category Management</h1>
          <p className="mt-0.5 text-xs text-[#64748B]">Manage inventory, categories, barcodes, stock levels, and store pricing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button type="button" onClick={handleExportCsv} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC]"><Download size={14} />Export CSV</button>
          {activeTab === "products" ? (
            <button type="button" onClick={openAddProductModal} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Plus size={14} />Add Product</button>
          ) : (
            <button type="button" onClick={openAddCategoryModal} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Plus size={14} />Add Categories</button>
          )}
        </div>
      </header>

      <section className="w-fit rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {[
            { key: "products", label: "Products", icon: Box },
            { key: "categories", label: "Categories", icon: Tag },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? "bg-[#0D8252] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-gray-500">Total Categories</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-bold leading-none text-gray-950">{categories.length}</p>
            <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-[#0D8252]">Active</span>
          </div>
        </div>
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-gray-500">Total Products</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-bold leading-none text-gray-950">{products.length}</p>
            <span className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600">In Store</span>
          </div>
        </div>
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-gray-500">Low Stock Items</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-bold leading-none text-amber-600">{lowStockCount}</p>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">Needs Reorder</span>
          </div>
        </div>
      </section>

      <section
        className={
          activeTab === "products"
            ? "flex flex-col gap-4"
            : "grid"
        }
      >
        <form
          onSubmit={activeTab === "categories" ? handleCategorySubmit : handleProductSubmit}
          className="hidden"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">
                {activeTab === "categories" ? (categoryEditId ? "Edit Category" : "Add Category") : (productEditId ? "Edit Product" : "Add Product")}
              </h2>
              <p className="text-sm text-gray-500">
                {activeTab === "categories"
                  ? "Create and manage product categories for product assignment."
                  : "Create and manage products with category, stock, and pricing data."}
              </p>
            </div>
            <Plus className="text-gray-400" size={21} />
          </div>

          <div className="grid gap-3">
            {activeTab === "categories" ? (
              <>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Category Name
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Protein Powder"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Description
                  <textarea
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 min-h-24 resize-y"
                    value={categoryForm.description}
                    onChange={(event) => setCategoryForm((form) => ({ ...form, description: event.target.value }))}
                    placeholder="All protein powder categories"
                  />
                </label>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Product Name
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={productForm.name}
                    onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Whey Protein"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Category
                  <select
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={productForm.categoryId}
                    onChange={(event) => setProductForm((form) => ({ ...form, categoryId: event.target.value }))}
                  >
                    <option value="">Select Category</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {formatDisplayValue(option.label)}
                      </option>
                    ))} 
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Brand
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={productForm.brand}
                    onChange={(event) => setProductForm((form) => ({ ...form, brand: event.target.value }))}
                    placeholder="Optimum Nutrition"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  SKU
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={productForm.sku}
                    onChange={(event) => setProductForm((form) => ({ ...form, sku: event.target.value }))}
                    placeholder="WHEY-001"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Barcode
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={productForm.barcode}
                    onChange={(event) => setProductForm((form) => ({ ...form, barcode: event.target.value }))}
                    placeholder="123456789"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Price
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="number"
                    value={productForm.price}
                    onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))}
                    placeholder="4500"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Sale Price
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="number"
                    value={productForm.salePrice}
                    onChange={(event) => setProductForm((form) => ({ ...form, salePrice: event.target.value }))}
                    placeholder="3999"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Stock Quantity
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="number"
                    value={productForm.stockQuantity}
                    onChange={(event) => setProductForm((form) => ({ ...form, stockQuantity: event.target.value }))}
                    placeholder="20"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Low Stock Threshold
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="number"
                    value={productForm.lowStockThreshold}
                    onChange={(event) => setProductForm((form) => ({ ...form, lowStockThreshold: event.target.value }))}
                    placeholder="5"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700 sm:col-span-1">
                  Image URL
                  <input
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={productForm.image}
                    onChange={(event) => setProductForm((form) => ({ ...form, image: event.target.value }))}
                    placeholder="https://example.com/image.jpg"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
                  Description
                  <textarea
                    className="min-h-16 w-full resize-y rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={productForm.description}
                    onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))}
                    placeholder="Premium whey protein isolate"
                  />
                </label>
                <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={productForm.isActive}
                    onChange={(event) => setProductForm((form) => ({ ...form, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 accent-[#0D8252] focus:ring-2 focus:ring-[#0D8252]/20"
                  />
                  Active Status
                </label>
              </div>
            )}
          </div>

          <div className={`mt-4 flex flex-col gap-2 sm:flex-row ${activeTab === "products" ? "sm:justify-end" : ""}`}>
            <button
              type="submit"
              className={`rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 ${
                activeTab === "products" ? "sm:min-w-36" : "flex-1"
              }`}
            >
              {activeTab === "categories" ? (categoryEditId ? "Update Category" : "Save Category") : (productEditId ? "Update Product" : "Save Product")}
            </button>
            {(activeTab === "categories" ? categoryEditId : productEditId) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryEditId(null);
                  setProductEditId(null);
                  setCategoryForm({ name: "", description: "" });
                  setProductForm({
                    name: "",
                    description: "",
                    categoryId: "",
                    sku: "",
                    barcode: "",
                    brand: "",
                    price: "",
                    salePrice: "",
                    stockQuantity: "",
                    lowStockThreshold: "",
                    image: "",
                    isActive: true,
                  });
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className={`rounded-xl bg-white shadow-sm ring-1 ring-gray-200 ${activeTab === "products" ? "order-1 overflow-hidden" : ""}`}>
          <div className="border-b border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-gray-500 sm:min-w-56">
                <Search size={15} className="text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${activeTab === "categories" ? "categories" : "products"}...`}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
                />
              </div>
              {activeTab === "products" && (
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-gray-700 outline-none transition focus:border-[#0D8252] focus:bg-white sm:w-40"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {formatDisplayValue(option.label)}
                    </option>
                  ))}
                </select>
              )}
              {activeTab === "categories" && <span className="text-[10px] font-semibold text-[#64748B]">Total: {filteredCategories.length} Items</span>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`${activeTab === "products" ? "min-w-[860px] w-full table-fixed" : "w-full"} text-left text-sm`}>
              {activeTab === "products" && (
                <colgroup>
                  <col className="w-[22%]" />
<col className="w-[13%]" />
<col className="w-[12%]" />
<col className="w-[11%]" />
<col className="w-[9%]" />
<col className="w-[9%]" />
<col className="w-[7%]" />
<col className="w-[7%]" />
<col className="w-[10%]" />
                </colgroup>
              )}
              {activeTab === "categories" && (
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[50%]" />
                  <col className="w-[14%]" />
                </colgroup>
              )}
              <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  {activeTab === "categories" ? (
                    ["Category Name", "Description", "Actions"].map((header) => (
                      <th key={header} className={`px-4 py-3 ${header === "Actions" ? "text-center" : ""}`}>
                        {header}
                      </th>
                    ))
                  ) : (
                    ["Product Details", "Barcode", "Category", "Brand", "Price", "Sale Price", "Stock", "Low Stock", "Actions"].map((header) => (
                      <th key={header} className="p-3 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                        {header}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "categories" ? filteredCategories : filteredProducts).map((entity) => {
                  const entityId = entity.id || entity._id || entity.sku || entity.name;
                  if (activeTab === "categories") {
                    return (
                      <tr key={entityId} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">{formatDisplayValue(entity.name)}</td>
                        <td className="px-4 py-3">{formatDisplayValue(entity.description)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleCategoryEdit(entity)}
                              className="inline-flex items-center justify-center rounded-lg hover:text-[#0D8252] transition"
                              aria-label="Edit record"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCategoryDelete(entity)}
                              className="inline-flex items-center justify-center rounded-lg transition text-red-600"
                              aria-label="Delete record"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <React.Fragment key={entityId}>
                      <tr className="border-t border-gray-100 align-top transition hover:bg-gray-50">
                        <td className="p-3 text-gray-800">
                          <div className="flex min-w-0 items-center gap-3">
                            {entity.image ? (
                              <img src={entity.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400"><Box size={16} /></div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-gray-900">{formatDisplayValue(entity.name)}</p>
                              <p className="mt-0.5 truncate text-[10px] text-gray-500">SKU: {formatDisplayValue(entity.sku || "-")}</p>
                              {/* <p className="truncate text-[10px] text-gray-400">{formatDisplayValue(entity.description || "Product variant")}</p> */}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-gray-700">
                          <p className=" text-gray-900">{formatDisplayValue(entity.barcode || "-")}</p>
                          {/* <p className="mt-1 text-[10px] text-gray-500">{entity.sku ? "Standard SKU" : "No barcode"}</p> */}
                        </td>
                        <td className="p-3 text-gray-700 text-xs">
                          <span className="block truncate">{getCategoryName(entity.categoryId)}</span>
                        </td>
                        <td className="p-3 text-gray-700 text-xs">
                          <span className="block truncate">{formatDisplayValue(entity.brand)}</span>
                        </td>
                        <td className="p-3 text-xs text-gray-800">{formatDisplayValue(entity.price)}</td>
                        <td className="p-3 text-xs text-[#0D8252]">{formatDisplayValue(entity.salePrice)}</td>
                        <td className={`p-3 ${isLowStock(entity) ? "font-semibold text-amber-700  text-xs" : "text-gray-700  text-xs"}`}>
                          {formatDisplayValue(entity.stockQuantity)}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex min-w-7 justify-center rounded-lg px-2 py-1 text-[10px] font-semibold ${isLowStock(entity) ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                            {formatDisplayValue(entity.lowStockThreshold)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-left gap-2">
                            <button
                              type="button"
                              onClick={() => handleProductEdit(entity)}
                              className="inline-flex items-center justify-center rounded-lg hover:text-[#0D8252] transition"
                              aria-label="Edit record"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleProductDelete(entity)}
                              className="inline-flex items-center justify-center rounded-lg text-red-600 transition"
                              aria-label="Delete record"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {((activeTab === "categories" ? filteredCategories : filteredProducts).length === 0) && (
                  <tr>
                    <td colSpan={activeTab === "categories" ? 3 : 9} className="p-6 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {activeTab === "products" && (
            <div class="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between"><p>Page 1 of 1 <span class="mx-2 text-[#CBD5E1]">|</span> Showing 3 records</p><div class="flex items-center gap-1.5"><button type="button" disabled="" class="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Prev</button><span class="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">1</span><button type="button" disabled="" class="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
          )}
          {activeTab === "categories" && (
            <div class="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between"><p>Page 1 of 1 <span class="mx-2 text-[#CBD5E1]">|</span> Showing 3 records</p><div class="flex items-center gap-1.5"><button type="button" disabled="" class="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Prev</button><span class="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">1</span><button type="button" disabled="" class="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
          )}

          <div className="grid gap-3 p-4 md:hidden">
            {(activeTab === "categories" ? filteredCategories : filteredProducts).map((entity) => {
              const entityId = entity.id || entity._id || entity.sku || entity.name;
              const summaryFields =
                activeTab === "categories"
                  ? [
                      { label: "Category", value: entity.name },
                      { label: "Description", value: entity.description },
                    ]
                  : [
                      { label: "Product", value: entity.name },
                      { label: "Category", value: getCategoryName(entity.categoryId) },
                      { label: "Brand", value: entity.brand },
                      { label: "Price", value: entity.price },
                      { label: "Stock", value: entity.stockQuantity },
                    ];
              return (
                <div key={entityId} className="rounded-lg border border-gray-200 p-3">
                  <div className="space-y-3">
                    {summaryFields.map((item) => (
                      <div key={item.label} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
                        <span className="font-medium text-gray-500">{item.label}</span>
                        <span className="min-w-0 break-words text-gray-800">{formatDisplayValue(item.value)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === "categories") {
                          handleCategoryEdit(entity);
                        } else {
                          handleProductEdit(entity);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100 px-3 py-2 text-sm font-semibold text-[#0D8252]"
                    >
                      <Edit size={15} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === "categories") {
                          void handleCategoryDelete(entity);
                        } else {
                          void handleProductDelete(entity);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      <Trash size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {((activeTab === "categories" ? filteredCategories : filteredProducts).length === 0) && (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No records found
              </div>
            )}
          </div>
        </div>
      </section>

      {activeTab === "categories" && (categoryEditId || isCategoryModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeCategoryModal()}>
          <form onSubmit={handleCategorySubmit} className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Tag size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">{categoryEditId ? "Edit Category" : "Add Category"}</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Create and manage product categories for product assignment.</p>
                </div>
              </div>
              <button type="button" onClick={closeCategoryModal} aria-label="Close Category modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Category Name
                  <input className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white" type="text" value={categoryForm.name} onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))} placeholder="Protein Powder" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Description
                  <textarea className="min-h-24 w-full resize-y rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white" value={categoryForm.description} onChange={(event) => setCategoryForm((form) => ({ ...form, description: event.target.value }))} placeholder="All protein powder categories" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={closeCategoryModal} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Tag size={13} />{categoryEditId ? "Update Category" : "Add Category"}</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "products" && (productEditId || isProductModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeProductEditModal()}>
          <form onSubmit={handleProductSubmit} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Box size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">{productEditId ? "Edit Product" : "Add Product"}</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">{productEditId ? "Update product information, inventory, pricing, and category assignments." : "Create a product with inventory, pricing, and category details."}</p>
                </div>
              </div>
              <button type="button" onClick={closeProductEditModal} aria-label="Close Product modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ProductFormFields productForm={productForm} setProductForm={setProductForm} categoryOptions={categoryOptions} formatDisplayValue={formatDisplayValue} />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={closeProductEditModal} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Edit size={15} />{productEditId ? "Update Product" : "Add Product"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StaffModule({ user }) {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "Trainer",
    phoneNumber: "",
    gender: "",
    dateOfBirth: "",
    city: "",
  });
  const itemsPerPage = 10;

  const toStaffRoleLabel = (value, fallback = "Staff") => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^role[_-]/, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalized || normalized === "staff" || normalized === "user") return fallback;
    if (normalized.includes("admin")) return "Admin";
    if (normalized.includes("trainer")) return "Trainer";
    if (normalized.includes("reception")) return "Receptionist";
    if (normalized.includes("manager")) return "Manager";

    return String(value)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getStaffRole = (staffUser, fallbackRole = "Staff") => {
    const nestedRoles = Array.isArray(staffUser.roles)
      ? staffUser.roles
          .map((assignment) => assignment?.role?.name || assignment?.name || assignment?.roleName)
          .filter(Boolean)
      : [];
    const roleCandidates = [
      ...nestedRoles,
      staffUser.staffRole,
      staffUser.roleName,
      staffUser.designation,
      staffUser.position,
      staffUser.userRole,
      staffUser.type,
      staffUser.category,
      staffUser.role,
    ];

    for (const candidate of roleCandidates) {
      const label = toStaffRoleLabel(candidate, "");
      if (label) return label;
    }

    return fallbackRole;
  };

  const normalizeStaff = (staffUser, fallbackRole = "Staff") => ({
    id: staffUser.id || staffUser._id || staffUser.userId || staffUser.email,
    name: staffUser.name || staffUser.fullName || "",
    email: staffUser.email || "",
    role: getStaffRole(staffUser, fallbackRole),
    phoneNumber: staffUser.phoneNumber || "",
    gender: staffUser.gender || "",
    dateOfBirth: staffUser.dateOfBirth || "",
    city: staffUser.city || "",
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const staffRequests = [
        { queryRole: "staff", fallbackRole: "Staff" },
        { queryRole: "admin", fallbackRole: "Admin" },
        { queryRole: "trainer", fallbackRole: "Trainer" },
        { queryRole: "receptionist", fallbackRole: "Receptionist" },
      ];
      const responses = await Promise.allSettled(
        staffRequests.map(({ queryRole }) => getTenantUsers(queryRole, user?.token))
      );
      const staffById = new Map();

      responses.forEach((result, index) => {
        if (result.status !== "fulfilled") return;

        const fallbackRole = staffRequests[index]?.fallbackRole || "Staff";
        unwrapList(result.value).forEach((staffUser) => {
          const normalizedStaff = normalizeStaff(staffUser, fallbackRole);
          const key = normalizedStaff.id || normalizedStaff.email;
          if (!key) return;

          const existingStaff = staffById.get(key);
          if (!existingStaff || existingStaff.role === "Staff") {
            staffById.set(key, { ...existingStaff, ...normalizedStaff });
          }
        });
      });

      const nextStaff = Array.from(staffById.values());

      setStaff(nextStaff);
      updateFilteredStaff(nextStaff, searchTerm);
    } catch (error) {
      toast.error(getApiError(error, "Could not load staff"));
    } finally {
      setLoading(false);
    }
  };

  const updateFilteredStaff = (staffList, search) => {
    const filtered = staffList.filter((s) =>
      [s.name, s.email, s.role, s.phoneNumber, s.city]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
    setFilteredStaff(filtered);
    setCurrentPage(1);
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  useEffect(() => {
    updateFilteredStaff(staff, searchTerm);
  }, [searchTerm]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!editingId && !formData.password.trim()) {
      toast.error("Password is required for new staff");
      return;
    }

    try {
      if (editingId) {
        const payload = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          phoneNumber: formData.phoneNumber,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          city: formData.city,
        };
        await updateTenantUser(editingId, payload);
        const updated = staff.map((s) =>
          s.id === editingId ? { ...s, ...formData } : s
        );
        setStaff(updated);
        updateFilteredStaff(updated, searchTerm);
        toast.success("Staff updated successfully");
      } else {
        const response = await createGymStaff({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          phoneNumber: formData.phoneNumber,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          city: formData.city,
        });
        const newStaffMember = normalizeStaff(unwrapObject(response), formData.role);
        const updated = [...staff, newStaffMember];
        setStaff(updated);
        updateFilteredStaff(updated, searchTerm);
        toast.success("Staff created successfully");
      }

      setIsFormOpen(false);
      setEditingId(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "Trainer",
        phoneNumber: "",
        gender: "",
        dateOfBirth: "",
        city: "",
      });
    } catch (error) {
      toast.error(getApiError(error, editingId ? "Update failed" : "Creation failed"));
    }
  };

  const handleEdit = (staffMember) => {
    setEditingId(staffMember.id);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      password: "",
      role: staffMember.role,
      phoneNumber: staffMember.phoneNumber,
      gender: staffMember.gender,
      dateOfBirth: staffMember.dateOfBirth,
      city: staffMember.city,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this staff member?")) return;

    try {
      await deleteUser(id);
      const updated = staff.filter((s) => s.id !== id);
      setStaff(updated);
      updateFilteredStaff(updated, searchTerm);
      toast.success("Staff deleted successfully");
    } catch (error) {
      toast.error(getApiError(error, "Could not delete staff"));
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "Trainer",
      phoneNumber: "",
      gender: "",
      dateOfBirth: "",
      city: "",
    });
  };

  const handleViewDetails = (staffMember) => {
    setViewingStaff(staffMember);
  };

  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filteredStaff.slice(start, start + itemsPerPage);

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Staff Management</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                Manage gym staff, trainers, and administrative personnel with role assignments.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded bg-gray-50 p-3">
            <Search size={18} className="text-gray-400" />
            <input
              placeholder="Search staff..."
              className="flex-1 bg-transparent text-sm outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:w-auto">
            <button
              onClick={() => {
                handleCancel();
                setIsFormOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Staff
            </button>
            {/* <button
              onClick={loadStaff}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Reload
            </button> */}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Staff</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{staff.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Trainers</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{staff.filter(s => s.role?.toLowerCase() === "trainer").length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Administrators</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{staff.filter(s => s.role?.toLowerCase() === "admin").length}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        {isFormOpen && (
          <form
            onSubmit={handleSave}
            className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 lg:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-950">
                  {editingId ? "Edit Staff Member" : "Add New Staff"}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingId
                    ? "Update staff member information"
                    : "Create a new staff member account"}
                </p>
              </div>
              <Plus className="text-gray-400" size={21} />
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Full Name
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>

              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="john@gym.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </label>

              {!editingId && (
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Password
                  <input
                    type="password"
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </label>
              )}

              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Role
                <select
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="Admin">Admin</option>
                  <option value="Trainer">Trainer</option>
                  <option value="Receptionist">Receptionist</option>
                  <option value="Manager">Manager</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Phone Number
                <input
                  type="tel"
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </label>

              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Gender
                <select
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Date of Birth
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </label>

              <label className="grid gap-1 text-sm font-medium text-gray-700">
                City
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-sm font-semibold text-gray-950">Name</th>
                  <th className="p-3 text-sm font-semibold text-gray-950">Email</th>
                  <th className="p-3 text-sm font-semibold text-gray-950">Phone</th>
                  <th className="p-3 text-sm font-semibold text-gray-950">Role</th>
                  <th className="p-3 text-sm font-semibold text-gray-950">Gender</th>
                  <th className="p-3 text-sm font-semibold text-gray-950">City</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-950">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s) => (
                  <tr key={s.id} className="border-t transition hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-950">{s.name}</td>
                    <td className="p-3 text-sm text-gray-600">{s.email}</td>
                    <td className="p-3 text-sm text-gray-600">{s.phoneNumber || "-"}</td>
                    <td className="p-3 text-sm">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {s.role}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{s.gender || "-"}</td>
                    <td className="p-3 text-sm text-gray-600">{s.city || "-"}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(s)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(s)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-sm text-gray-500">
                      {loading ? "Loading staff..." : "No staff found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 p-4 sm:flex-row">
            <p className="text-sm text-gray-600">
              Page {currentPage} of {totalPages || 1} ({filteredStaff.length} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages || 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-950">Staff Details</h2>
              <button
                onClick={() => setViewingStaff(null)}
                className="inline-flex items-center justify-center rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Full Name</p>
                  <p className="text-sm font-medium text-gray-950">{viewingStaff.name || "-"}</p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-950">{viewingStaff.email || "-"}</p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role</p>
                  <span className="inline-flex w-max rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {viewingStaff.role || "-"}
                  </span>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone Number</p>
                  <p className="text-sm font-medium text-gray-950">{viewingStaff.phoneNumber || "-"}</p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gender</p>
                  <p className="text-sm font-medium text-gray-950">{viewingStaff.gender || "-"}</p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date of Birth</p>
                  <p className="text-sm font-medium text-gray-950">
                    {viewingStaff.dateOfBirth ? new Date(viewingStaff.dateOfBirth).toLocaleDateString() : "-"}
                  </p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">City</p>
                  <p className="text-sm font-medium text-gray-950">{viewingStaff.city || "-"}</p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Staff ID</p>
                  <p className="text-sm font-mono text-gray-600">{viewingStaff.id || "-"}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    handleEdit(viewingStaff);
                    setViewingStaff(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Edit size={15} />
                  Edit
                </button>
                <button
                  onClick={() => setViewingStaff(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay checkout is only available in the browser."));
      return;
    }

    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existing = document.querySelector('script[data-razorpay="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.setAttribute("data-razorpay", "true");
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Unable to load Razorpay script."));
    document.body.appendChild(script);
  });
}

function OwnerSubscriptionsModule({ user }) {
  const token = user?.accessToken || user?.token;
  const { refreshSubscriptionStatus, updateUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentOrders, setPaymentOrders] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState("");
  const [processingAction, setProcessingAction] = useState("");
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState("MONTHLY");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: "", reason: "" });

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const response = await getBillingPlans({}, token);
      const list = Array.isArray(response?.data) ? response.data : unwrapList(response);
      setPlans(list);
    } catch (error) {
      console.warn("Unable to load SaaS billing plans:", error);
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadSubscription = async () => {
    if (!token) return;

    try {
      setLoadingSubscription(true);
      const response = await getCurrentSubscription(token);
      setSubscription(response?.data || response || null);
    } catch {
      setSubscription(null);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const loadPayments = async () => {
    if (!token) return;

    try {
      setLoadingPayments(true);
      const response = await getPaymentHistory(token);
      const list = Array.isArray(response?.data) ? response.data : unwrapList(response);
      setPayments(list);
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadPaymentOrders = async () => {
    if (!token) return;

    try {
      const response = await getPaymentOrders({ purpose: "SAAS_SUBSCRIPTION", limit: 20 }, token);
      const data = response?.data || response || {};
      setPaymentOrders(Array.isArray(data) ? data : data.items || []);
    } catch {
      setPaymentOrders([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadPlans();
    void loadSubscription();
    void loadPayments();
    void loadPaymentOrders();
  }, [token]);

  useEffect(() => {
    if (!showCancelConfirmation) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCancelConfirmation]);

  useEffect(() => {
    if (!showPaymentHistory) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPaymentHistory]);

  const refreshBilling = async () => {
    await Promise.all([loadSubscription(), loadPayments(), loadPaymentOrders()]);
  };

  const openCheckout = async (checkout, successMessage) => {
    if (!checkout) return false;
    if (checkout.checkoutUrl) {
      window.location.assign(checkout.checkoutUrl);
      return true;
    }
    if (checkout.provider !== "RAZORPAY" || !checkout.clientKey || !checkout.providerOrderId) {
      throw new Error("This payment provider is not available in the web portal.");
    }

    await loadRazorpayScript();
    const razorpayInstance = new window.Razorpay({
      key: checkout.clientKey,
      amount: Number(checkout.amount || 0) * 100,
      currency: checkout.currency || "INR",
      name: "Gym Dashboard",
      description: "SaaS subscription payment",
      order_id: checkout.providerOrderId,
      handler: async (response) => {
        try {
          const verification = await verifyPayment({
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }, token);
          const verified = verification?.data || verification || {};
          if (verified.success || verified.status === "CAPTURED") {
            toast.success(successMessage);
            await refreshBilling();
            await refreshSubscriptionStatus();
          } else {
            toast.error(getApiError({ response: { data: verified } }, "Payment verification failed"));
          }
        } catch (error) {
          toast.error(getApiError(error, "Payment verification failed"));
        }
      },
      modal: { ondismiss: () => toast.error("Payment cancelled") },
      theme: { color: "#2563eb" },
    });
    razorpayInstance.on("payment.failed", (response) => {
      toast.error(response?.error?.description || "Payment failed");
      void refreshBilling();
    });
    razorpayInstance.open();
    return true;
  };

  const getCheckout = async (data, plan, purpose = "SAAS_SUBSCRIPTION") => {
    if (data?.checkout) return data.checkout;

    const currentSubscription = data?.subscription || data;
    const currentStatus = String(currentSubscription?.status || "").toUpperCase();
    if (!currentSubscription?.id || !["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(currentStatus)) return null;

    const response = await createPaymentCheckout({
      purpose,
      saasSubscriptionId: currentSubscription.id,
      amount: Number(data?.amountDue || plan?.price || currentSubscription?.saasPlan?.price || 0),
      currency: String(plan?.currency || currentSubscription?.currency || "INR").toUpperCase(),
      receipt: `saas_${currentSubscription.id}_${Date.now()}`.slice(0, 40),
    }, token);
    return response?.data || response || null;
  };

  const handleViewOrder = async (orderId) => {
    try {
      setProcessingAction(`order-${orderId}`);
      const response = await getPaymentOrder(orderId, token);
      setSelectedOrder(response?.data || response || null);
      setRefundForm({ amount: "", reason: "" });
    } catch (error) {
      toast.error(getApiError(error, "Unable to load payment order"));
    } finally {
      setProcessingAction("");
    }
  };

  const handleRefund = async (event) => {
    event.preventDefault();
    const amount = Number(refundForm.amount);
    if (!selectedOrder?.id || selectedOrder.status !== "CAPTURED" || !amount || amount <= 0) {
      toast.error("Enter a valid refund amount for a captured order");
      return;
    }
    try {
      setProcessingAction("refund");
      await createPaymentRefund({ orderId: selectedOrder.id, amount, reason: refundForm.reason.trim() || undefined }, token);
      toast.success("Refund requested");
      setSelectedOrder(null);
      setRefundForm({ amount: "", reason: "" });
      await loadPaymentOrders();
    } catch (error) {
      toast.error(getApiError(error, "Unable to create refund"));
    } finally {
      setProcessingAction("");
    }
  };

  const handleSubscribe = async (plan) => {
    const planId = plan?.id || plan?._id;

    try {
      setSubscribingPlanId(planId);
      const response = await subscribeToBillingPlan({ saasPlanId: planId, autoRenew: false }, token);
      const data = response?.data || response || {};
      const checkout = await getCheckout(data, plan);
      if (!(await openCheckout(checkout, "Payment successful"))) {
        toast.success("Subscribed to plan successfully");
        await refreshBilling();
        await refreshSubscriptionStatus();
      }
    } catch (error) {
      const providerUnavailable = error?.response?.status === 503 || getApiError(error, "").toLowerCase().includes("no payment provider");
      if (providerUnavailable) {
        try {
          const currentResponse = await getCurrentSubscription(token);
          const current = currentResponse?.data || currentResponse || {};
          const checkout = await getCheckout({ subscription: current }, plan);
          if (await openCheckout(checkout, "Payment successful")) return;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
      console.error("Subscription payment flow failed:", error);
      toast.error(getApiError(error, "Subscription failed"));
    } finally {
      setSubscribingPlanId("");
    }
  };

  const handleUpgrade = async (plan) => {
    try {
      setProcessingAction(`upgrade-${plan.id}`);
      const response = await upgradeSubscription({ saasPlanId: plan.id, autoRenew: false }, token);
      const data = response?.data || response || {};
      const checkout = await getCheckout(data, plan);
      if (!(await openCheckout(checkout, "Upgrade payment successful"))) {
        toast.success("Subscription upgraded");
        await refreshBilling();
        await refreshSubscriptionStatus();
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to upgrade subscription"));
    } finally {
      setProcessingAction("");
    }
  };

  const handleCancel = async () => {
    if (!hasActiveSubscription) return;
    try {
      setProcessingAction("cancel");
      const response = await cancelSubscription(token);
      const cancelledSubscription = response?.data || response || null;
      setSubscription(cancelledSubscription);
      const returnedStatus = cancelledSubscription?.subscription?.status
        || cancelledSubscription?.subscriptionStatus
        || cancelledSubscription?.status;
      updateUser({ ...user, subscriptionStatus: returnedStatus || "CANCELLED" });
      toast.success("Subscription cancelled");
      setShowCancelConfirmation(false);
    } catch (error) {
      toast.error(getApiError(error, "Unable to cancel subscription"));
    } finally {
      setProcessingAction("");
    }
  };

  const handleRenew = async () => {
    try {
      setProcessingAction("renew");
      const response = await renewSubscription(token);
      const data = response?.data || response || {};
      setSubscription(data.subscription || data);
      const checkout = await getCheckout(data, subscription?.saasPlan);
      if (!(await openCheckout(checkout, "Renewal payment successful"))) {
        toast.success("Subscription renewed");
        await refreshBilling();
        await refreshSubscriptionStatus();
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to renew subscription"));
    } finally {
      setProcessingAction("");
    }
  };

  const status = String(subscription?.status || "").toUpperCase();
  const hasActiveSubscription = isSubscriptionActive(status);
  const canRenew = ["EXPIRED", "CANCELLED", "PENDING_PAYMENT", "PAYMENT_FAILED"].includes(status);
  const currentPlanPrice = Number(subscription?.saasPlan?.price || 0);

  const formatMoney = (amount, currency = "INR") => {
    const normalizedCurrency = String(currency || "INR").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: normalizedCurrency,
        minimumFractionDigits: 2,
      }).format(Number(amount || 0));
    } catch {
      return `${normalizedCurrency} ${Number(amount || 0).toFixed(2)}`;
    }
  };

  const formatFeatureLabel = (feature) => {
    if (typeof feature === "string") return feature;
    if (feature && typeof feature === "object") {
      return feature.name || feature.label || feature.title || feature.id || "Feature";
    }
    return "Feature";
  };

  const normalizeBillingPeriod = (plan) => {
    const cycle = String(plan?.billingCycle || plan?.billingPeriod || plan?.planType || plan?.period || "").toUpperCase();
    if (cycle.includes("QUARTER")) return "QUARTERLY";
    if (cycle.includes("YEAR") || cycle.includes("ANNUAL")) return "YEARLY";
    const durationDays = getPlanDurationDays({ ...plan, planType: plan?.planType || plan?.billingCycle || plan?.billingPeriod || plan?.period });
    if (durationDays >= 300) return "YEARLY";
    if (durationDays >= 80) return "QUARTERLY";
    return "MONTHLY";
  };
  const billingPeriods = ["MONTHLY", "QUARTERLY", "YEARLY"].filter((period) =>
    plans.some((plan) => normalizeBillingPeriod(plan) === period)
  );
  const activeBillingPeriod = billingPeriods.includes(billingPeriod) ? billingPeriod : billingPeriods[0] || "";
  const filteredPlans = plans.filter((plan) => normalizeBillingPeriod(plan) === activeBillingPeriod);
  const formatPlanCycle = (plan) => normalizeBillingPeriod(plan);
  const formatDuration = (plan) => `${Number(plan?.durationDays || plan?.duration || 30) || 30} days`;
  const paymentPlanFor = (payment) => payment?.subscription?.saasPlan
    || payment?.saasSubscription?.saasPlan
    || payment?.plan
    || payment?.saasPlan;
  const paymentBillingPeriod = (payment) => {
    const plan = paymentPlanFor(payment);
    const cycle = plan?.billingCycle || plan?.planType || payment?.billingCycle || payment?.planType;
    return cycle ? normalizeBillingPeriod({ billingCycle: cycle }) : "-";
  };
  const paymentDate = (payment) => {
    const value = payment?.paidAt || payment?.createdAt || payment?.paymentDate || payment?.date;
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };
  const paymentReference = (payment) => {
    const transaction = payment?.transactions?.[0] || payment?.transaction || {};
    return payment?.providerPaymentId
      || payment?.paymentId
      || transaction?.providerPaymentId
      || transaction?.paymentId
      || payment?.providerOrderId
      || payment?.id
      || "-";
  };
  const paymentMethod = (payment) => {
    const transaction = payment?.transactions?.[0] || payment?.transaction || {};
    return payment?.paymentMethod || payment?.method || transaction?.paymentMethod || transaction?.method || "-";
  };
  const currentSubscriptionLabel = loadingSubscription
    ? "Loading subscription..."
    : subscription
      ? `${status || "UNKNOWN"}${subscription?.endDate ? ` - Ends ${new Date(subscription.endDate).toLocaleDateString()}` : ""}`
      : "No subscription yet";

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold leading-6 tracking-tight text-[#020617]">SaaS Subscription Management</h1>
        <p className="mt-1 text-xs text-[#64748B]">
          Browse available SaaS plans, manage your gym subscription, and review billing history.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase text-gray-500">Current subscription</p>
            <h2 className="mt-1 truncate text-lg font-bold text-gray-950">
              {subscription?.saasPlan?.name || "No active plan"}
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              {subscription ? `Status: ${currentSubscriptionLabel}` : "Subscribe to a plan to activate your gym account."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {subscription ? (
              <>
                {canRenew && (
                  <button
                    type="button"
                    onClick={() => void handleRenew()}
                    disabled={processingAction === "renew"}
                    className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {processingAction === "renew" ? "Renewing..." : "Renew"}
                  </button>
                )}
                {hasActiveSubscription && (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirmation(true)}
                    disabled={processingAction === "cancel"}
                    className="rounded-lg border border-red-500 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Cancel Subscription
                  </button>
                )}
              </>
            ) : (
              <span className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-600">No current subscription</span>
            )}
          </div>
        </div>
      </section>

      {showCancelConfirmation && (
        <div
          className="fixed inset-0 z-50 h-screen flex items-center justify-center bg-slate-900/30 p-4"
          onMouseDown={(event) => event.target === event.currentTarget && processingAction !== "cancel" && setShowCancelConfirmation(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-subscription-title"
            aria-describedby="cancel-subscription-message"
            className="w-full max-w-md overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600"><TriangleAlert size={18} /></div>
                <div>
                  <h2 id="cancel-subscription-title" className="text-base font-bold text-[#0F172A]">Cancel Subscription</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Confirm your subscription cancellation.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelConfirmation(false)}
                disabled={processingAction === "cancel"}
                aria-label="Close cancellation confirmation"
                className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={17} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p id="cancel-subscription-message" className="text-sm font-semibold text-[#334155]">Are you sure you want to cancel your subscription?</p>
              <p className="mt-2 text-xs leading-5 text-[#64748B]">Your subscription will be cancelled, and access to subscription features may be affected according to your subscription terms.</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => setShowCancelConfirmation(false)}
                disabled={processingAction === "cancel"}
                className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={processingAction === "cancel"}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingAction === "cancel" ? "Cancelling..." : "Cancel Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-5">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <CreditCard size={16} />
              </span>
              <h2 className="text-base font-bold text-gray-950">Available SaaS plans</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentHistory(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] sm:self-auto"
            >
              <CalendarDays size={14} /> Payment History
            </button>
          </div>

          {!loadingPlans && billingPeriods.length > 0 && (
            <div role="tablist" aria-label="Billing period" className="mt-4 inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-1">
              {billingPeriods.map((period) => (
                <button
                  key={period}
                  type="button"
                  role="tab"
                  aria-selected={activeBillingPeriod === period}
                  onClick={() => setBillingPeriod(period)}
                  className={`h-8 rounded-md px-3 text-xs font-semibold transition ${activeBillingPeriod === period ? "bg-[#0D8252] text-white shadow-sm" : "text-[#475569] hover:bg-white hover:text-[#0F172A]"}`}
                >
                  {period.charAt(0) + period.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}

          {loadingPlans ? (
            <p className="mt-4 text-sm text-gray-500">Loading plans...</p>
          ) : filteredPlans.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No plans available</p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {filteredPlans.map((plan) => {
                const planId = idOf(plan);
                const isCurrentPlan = String(subscription?.saasPlan?.id) === String(planId);
                const canUpgrade = hasActiveSubscription && !isCurrentPlan && Number(plan.price || 0) >= currentPlanPrice;
                const isRetry = isCurrentPlan && ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(status);
                const isProcessing = subscribingPlanId === planId || processingAction === `upgrade-${planId}`;

                return (
                  <div
                    key={planId}
                    className={`rounded-lg border p-4 ${isCurrentPlan ? "border-emerald-200 bg-emerald-50/20" : "border-gray-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-gray-950">{plan.name}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                          {plan.description || "Flexible SaaS access for your gym."}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#0D8252]/10 px-2.5 py-1 text-[10px] font-bold text-[#0D8252]">
                        {formatPlanCycle(plan)}
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-gray-950">
                          {formatMoney(plan.price, plan.currency || subscription?.currency || subscription?.saasPlan?.currency || "INR")}
                        </p>
                        <p className="text-xs text-gray-500">/ {formatDuration(plan)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void (canUpgrade ? handleUpgrade(plan) : handleSubscribe(plan))}
                        disabled={isProcessing || (hasActiveSubscription && !canUpgrade)}
                        className={`mt-4 h-9 w-full rounded-lg px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                          isRetry
                            ? "border border-emerald-700 text-emerald-800 hover:bg-emerald-50"
                            : "bg-emerald-700 text-white hover:bg-emerald-800"
                        }`}
                      >
                        {isProcessing
                          ? "Processing..."
                          : canUpgrade
                            ? "Upgrade"
                            : isRetry
                              ? "Retry payment"
                              : hasActiveSubscription
                                ? "Active"
                                : "Subscribe"}
                      </button>
                    </div>

                    <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-emerald-600" /> Trial: {plan.trialDays ? `${plan.trialDays} days` : "None"}
                      </div>
                    </div>

                    <div className="mt-5 text-xs text-gray-600">
                      <p className="font-semibold uppercase text-gray-400">Included features</p>
                      {Array.isArray(plan.features) && plan.features.length ? (
                        <ul className="mt-3 space-y-2">
                          {plan.features.map((feature, index) => (
                            <li key={`${formatFeatureLabel(feature)}-${index}`} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                              <span>{formatFeatureLabel(feature)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-xs text-gray-500">No feature list provided.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </section>

      {showPaymentHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setShowPaymentHistory(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-history-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><CreditCard size={18} /></div>
                <div>
                  <h2 id="payment-history-title" className="text-base font-bold text-[#0F172A]">Payment History</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Review SaaS subscription payments and order details.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowPaymentHistory(false)} aria-label="Close payment history" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {loadingPayments ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-gray-500">Loading payment history...</div>
              ) : paymentOrders.length === 0 && payments.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-gray-400"><CreditCard size={24} /></div>
                  <p className="mt-4 text-sm font-bold text-gray-700">No payment history available</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Completed subscription payments and their receipts will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-[#64748B]">
                      <tr>
                        <th className="px-3 py-3">Payment date</th>
                        <th className="px-3 py-3">Plan</th>
                        <th className="px-3 py-3">Billing period</th>
                        <th className="px-3 py-3">Amount</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Reference ID</th>
                        <th className="px-3 py-3">Method</th>
                        <th className="px-3 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentOrders.length ? paymentOrders : payments).map((payment) => {
                        const plan = paymentPlanFor(payment);
                        const paymentId = payment.id || payment._id;
                        return (
                          <tr key={paymentId || paymentReference(payment)} className="border-t border-[#EEF2F4] text-[#475569]">
                            <td className="whitespace-nowrap px-3 py-3">{paymentDate(payment)}</td>
                            <td className="px-3 py-3 font-semibold text-[#0F172A]">{plan?.name || plan?.title || payment?.planName || "-"}</td>
                            <td className="px-3 py-3">{paymentBillingPeriod(payment)}</td>
                            <td className="whitespace-nowrap px-3 py-3 font-semibold">{formatMoney(payment.amount, payment.currency)}</td>
                            <td className="px-3 py-3"><StatusBadge status={payment.status || "UNKNOWN"} label={payment.status || "-"} /></td>
                            <td className="max-w-44 truncate px-3 py-3" title={paymentReference(payment)}>{paymentReference(payment)}</td>
                            <td className="px-3 py-3">{paymentMethod(payment)}</td>
                            <td className="px-3 py-3">
                              {paymentOrders.length > 0 && paymentId ? (
                                <button type="button" onClick={() => void handleViewOrder(paymentId)} disabled={processingAction === `order-${paymentId}`} className="whitespace-nowrap font-semibold text-[#0D8252] hover:text-[#086B43] disabled:opacity-60">
                                  {processingAction === `order-${paymentId}` ? "Loading..." : "View details"}
                                </button>
                              ) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedOrder && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">Order details</p>
                      <p className="mt-1 break-all text-xs text-gray-600">{selectedOrder.providerOrderId || selectedOrder.id}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-lg font-semibold text-gray-500 hover:text-gray-900">Close details</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 sm:grid-cols-4">
                    <span>Status: <strong>{selectedOrder.status || "-"}</strong></span>
                    <span>Amount: <strong>{formatMoney(selectedOrder.amount, selectedOrder.currency)}</strong></span>
                    <span>Transactions: <strong>{selectedOrder.transactions?.length || 0}</strong></span>
                    <span>Refunds: <strong>{selectedOrder.refunds?.length || 0}</strong></span>
                  </div>
                  {selectedOrder.status === "CAPTURED" && (
                    <form onSubmit={handleRefund} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                      <input type="number" min="0.01" max={Number(selectedOrder.amount || 0)} step="0.01" placeholder="Refund amount" value={refundForm.amount} onChange={(event) => setRefundForm((form) => ({ ...form, amount: event.target.value }))} className="rounded-md border border-gray-300 bg-white p-2 text-xs" required />
                      <input placeholder="Reason (optional)" value={refundForm.reason} onChange={(event) => setRefundForm((form) => ({ ...form, reason: event.target.value }))} className="rounded-md border border-gray-300 bg-white p-2 text-xs" />
                      <button type="submit" disabled={processingAction === "refund"} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{processingAction === "refund" ? "Requesting..." : "Refund"}</button>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={() => setShowPaymentHistory(false)} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Close</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ModuleWorkspace({ moduleKey, definition }) {
  const { user } = useAuth();
  const loggedUserAccessToken = user?.accessToken || user?.token;
  const [records, setRecords] = useState(() => getStoredRecords(definition));
  const [form, setForm] = useState(() => getEmptyForm(definition.fields));
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [members] = useState(() =>
    moduleKey === "subscriptions" ? getStoredRecords({ storageKey: "members" }) : []
  );
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    if (moduleKey !== "subscriptions") return;

    const loadPlans = async () => {
      try {
        const response = await getMembershipPlans(loggedUserAccessToken);
        setPlans(unwrapList(response).map(normalizePlan));
      } catch (error) {
        console.warn("Unable to load subscription plans:", error);
        setPlans([]);
      }
    };

    void loadPlans();
  }, [loggedUserAccessToken, moduleKey]);

  const getMemberName = (id) => {
    const member = members.find(m => idOf(m) === id);
    return member ? member.name : id;
  };

  const getPlanName = (id) => {
    const plan = plans.find(p => idOf(p) === id);
    return plan ? plan.name : id;
  };

  const getPlanPrice = (id) => {
    const plan = plans.find(p => String(idOf(p)) === String(id));
    const price = Number(plan?.price ?? plan?.amount ?? plan?.fee);

    return Number.isFinite(price) ? price : 0;
  };

  const displayFields = getDisplayFields(definition);
  const Icon = definition.icon;
  const canCreate = canAccess(user, moduleKey, "create");
  const canEdit = canAccess(user, moduleKey, "edit");
  const canDelete = canAccess(user, moduleKey, "delete");

  const filteredRecords = useMemo(() => {
    const query = search.toLowerCase();
    return records.filter((record) =>
      Object.values(record).join(" ").toLowerCase().includes(query)
    );
  }, [records, search]);

  const totals = useMemo(() => {
    const statusCounts = records.reduce((counts, record) => {
      if (record.status) counts[record.status] = (counts[record.status] || 0) + 1;
      return counts;
    }, {});

    const amountTotal = records.reduce((total, record) => {
      if (moduleKey === "subscriptions") {
        return total + getPlanPrice(record.plan);
      }

      const amount = Number(record.amount);
      return Number.isFinite(amount) ? total + amount : total;
    }, 0);

    return { statusCounts, amountTotal };
  }, [moduleKey, plans, records]);

  if (moduleKey === "attendance") {
    return (
      <div className="space-y-4">
        <AttendanceStatus />
        <AdminAttendance />
      </div>
    );
  }

  const saveRecords = (nextRecords) => {
    setRecords(nextRecords);
    localStorage.setItem(definition.storageKey, JSON.stringify(nextRecords));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if ((editId && !canEdit) || (!editId && !canCreate)) {
      toast.error("You do not have permission to save records in this module");
      return;
    }

    if (moduleKey === "subscriptions") {
      if (!form.member || !form.plan) {
        toast.error("Member and Plan are required");
        return;
      }

      if (editId) {
        const nextRecords = records.map((record) =>
          record.id === editId ? { ...record, ...form } : record
        );
        saveRecords(nextRecords);
        setForm(getEmptyForm(definition.fields));
        setEditId(null);
        toast.success("Subscription updated");
        return;
      }

      try {
        await subscribeToPlan(form.member, form.plan, loggedUserAccessToken);
        const nextRecords = [{ id: Date.now(), ...form }, ...records];
        saveRecords(nextRecords);
        setForm(getEmptyForm(definition.fields));
        toast.success("Member subscribed to plan successfully");
      } catch (error) {
        toast.error(getApiError(error, "Failed to subscribe member to plan"));
      }
      return;
    }

    const firstField = definition.fields[0];
    if (!String(form[firstField.name] || "").trim()) {
      toast.error(`${firstField.label} is required`);
      return;
    }

    const nextRecords = editId
      ? records.map((record) => (record.id === editId ? { ...record, ...form } : record))
      : [{ id: Date.now(), ...form }, ...records];

    saveRecords(nextRecords);
    setForm(getEmptyForm(definition.fields));
    setEditId(null);
    toast.success(editId ? "Record updated" : "Record added");
  };

  const handleEdit = (record) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit this module");
      return;
    }
    setEditId(record.id);
    setForm(
      definition.fields.reduce((nextForm, field) => {
        nextForm[field.name] = record[field.name] || "";
        return nextForm;
      }, {})
    );
  };

  const handleDelete = (id) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete records in this module");
      return;
    }
    if (!confirm("Delete this record?")) return;
    saveRecords(records.filter((record) => record.id !== id));
    toast.error("Record deleted");
  };

  const handleExport = () => {
    const payload = JSON.stringify(filteredRecords, null, 2);
    navigator.clipboard?.writeText(payload);
    toast.success("JSON copied for REST/API use");
  };

  return (
    <div className="space-y-6">
      {/* <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
              <Icon size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">{definition.title}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">{definition.description}</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <Download size={17} />
            Export JSON
          </button>
        </div>
      </section> */}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Records</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{records.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Primary Status</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(totals.statusCounts).length ? (
              Object.entries(totals.statusCounts).map(([status, count]) => (
                <span key={status} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {status}: {count}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No status data</span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Amount Total</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">Rs. {totals.amountTotal.toLocaleString("en-IN")}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">
                {editId ? "Edit Record" : definition.primaryAction}
              </h2>
              <p className="text-sm text-gray-500">
                {canCreate || canEdit
                  ? "Saved locally and exportable as JSON."
                  : "View-only access for this module."}
              </p>
            </div>
            <Plus className="text-gray-400" size={21} />
          </div>

          <div className="grid gap-3">
            {definition.fields.map((field) => (
              <label key={field.name} className="grid gap-1 text-sm font-medium text-gray-700">
                {field.label}
                {renderField(field, form[field.name] || "", setForm, moduleKey, members, plans)}
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={(editId && !canEdit) || (!editId && !canCreate)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {editId ? "Update" : "Save"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm(getEmptyForm(definition.fields));
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="border-b border-gray-200 p-4">
            <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
              <Search size={17} className="text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${definition.title.toLowerCase()}...`}
                className="w-full outline-none"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {displayFields.map((field) => (
                    <th key={field.name} className="min-w-32 p-3 font-semibold">
                      {field.label}
                    </th>
                  ))}
                  <th className="p-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-t border-gray-200">
                    {displayFields.map((field) => (
                      <td key={field.name} className="p-3 text-gray-700 text-xs">
                        {field.name === "status" || field.name === "apiAccess" ? (
                          record[field.name] ? <StatusBadge status={record[field.name]} label={record[field.name]} /> : null
                        ) : field.name === "member" && moduleKey === "subscriptions" ? (
                          getMemberName(record[field.name])
                        ) : field.name === "plan" && moduleKey === "subscriptions" ? (
                          getPlanName(record[field.name])
                        ) : (
                          record[field.name] || "-"
                        )}
                      </td>
                    ))}
                    <td className="p-3">
                      <div className="flex justify-center gap-3">
              <button
                          type="button"
                          onClick={() => handleEdit(record)}
                          disabled={!canEdit}
                          className="rounded-lg text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Edit record"
                        >
                          <Edit size={15} />
                        </button>
              <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          disabled={!canDelete}
                          className="rounded-lg text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Delete record"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredRecords.length && (
                  <tr>
                    <td colSpan={displayFields.length + 1} className="p-6 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {filteredRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-gray-200 p-3">
                <div className="space-y-3">
                  {displayFields.map((field) => (
                    <div key={field.name} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
                      <span className="font-medium text-gray-500">{field.label}</span>
                      <span className="min-w-0 break-words text-gray-800">
                        {field.name === "status" || field.name === "apiAccess" ? (
                          record[field.name] ? <StatusBadge status={record[field.name]} label={record[field.name]} /> : null
                        ) : field.name === "member" && moduleKey === "subscriptions" ? (
                          getMemberName(record[field.name])
                        ) : field.name === "plan" && moduleKey === "subscriptions" ? (
                          getPlanName(record[field.name])
                        ) : (
                          record[field.name] || "-"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(record)}
                    disabled={!canEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Edit size={15} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(record.id)}
                    disabled={!canDelete}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {!filteredRecords.length && (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No records found
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {definition.insights.map((insight) => (
          <div key={insight} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-950">{insight}</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              This capability is wired into the {definition.title.toLowerCase()} module and can be exported as JSON for API integration.
            </p>
          </div>
        ))}
      </section>

    </div>
  );
}
