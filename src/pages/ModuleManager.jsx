import React, { useMemo, useState, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Box, ChevronLeft, ChevronRight, Download, Edit, Minus, Plus, Search, Tag, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { moduleDefinitions, statusTone } from "../data/moduleDefinitions";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";
import AttendanceStatus from "../components/AttendanceStatus";
import AdminAttendance from "../components/AdminAttendance";
import AdminFacilities from "../components/AdminFacilities";
import AdminWorkouts from "../components/AdminWorkouts";
import FacilityMaintenance from "../components/FacilityMaintenance";
import TrainerSchedule from "./TrainerSchedule";
import {
  getApiError,
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

function StatusBadge({ value }) {
  if (!value) return null;

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone[value] || "bg-gray-100 text-gray-700"}`}>
      {value}
    </span>
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

  if (moduleKey === "workouts") {
    return <AdminWorkouts />;
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

  return (
    <ModuleWorkspace
      key={moduleKey}
      moduleKey={moduleKey}
      definition={moduleDefinitions[moduleKey]}
    />
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
  const [productEditId, setProductEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expandedProductId, setExpandedProductId] = useState(null);

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
      void Promise.all([loadProducts(), loadCategories()]);
    } catch (error) {
      toast.error(getApiError(error, "Failed to save product"));
    }
  };

  const handleCategoryEdit = (category) => {
    setCategoryEditId(category.id || category._id);
    setCategoryForm({
      name: category.name || "",
      description: category.description || "",
    });
  };

  const handleProductEdit = (product) => {
    setProductEditId(product.id || product._id);
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
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
              <Box size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Product & Category Management</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                Manage product categories and inventory with authenticated API integration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(JSON.stringify({ categories, products }, null, 2));
              toast.success("JSON copied for API review");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <Download size={17} />
            Export JSON
          </button>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "products", label: "Products", icon: Box },
            { key: "categories", label: "Categories", icon: Tag },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Categories</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{categories.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Products</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{products.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{lowStockCount}</p>
        </div>
      </section>

      <section
        className={
          activeTab === "products"
            ? "grid gap-6 xl:grid-cols-[minmax(24rem,0.78fr)_minmax(0,1.42fr)]"
            : "grid gap-6 lg:grid-cols-[0.75fr_1.25fr] xl:grid-cols-[0.65fr_1.35fr]"
        }
      >
        <form
          onSubmit={activeTab === "categories" ? handleCategorySubmit : handleProductSubmit}
          className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${
            activeTab === "products" ? "p-4 lg:p-5" : "p-4"
          }`}
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
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Active Status
                </label>
              </div>
            )}
          </div>

          <div className={`mt-4 flex flex-col gap-2 sm:flex-row ${activeTab === "products" ? "sm:justify-end" : ""}`}>
            <button
              type="submit"
              className={`rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 ${
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
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${activeTab === "products" ? "overflow-hidden" : ""}`}>
          <div className="border-b border-gray-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-3 shadow-sm sm:min-w-64">
                <Search size={17} className="text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${activeTab === "categories" ? "categories" : "products"}...`}
                  className="w-full outline-none"
                />
              </div>
              {activeTab === "products" && (
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-auto"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {formatDisplayValue(option.label)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className={`hidden md:block ${activeTab === "products" ? "min-h-[32rem]" : ""}`}>
            <table className={`${activeTab === "products" ? "w-full table-fixed" : "w-full"} text-left text-sm`}>
              {activeTab === "products" && (
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[19%]" />
                </colgroup>
              )}
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {activeTab === "categories" ? (
                    ["Category Name", "Description", "Actions"].map((header) => (
                      <th key={header} className="min-w-32 p-3 font-semibold">
                        {header}
                      </th>
                    ))
                  ) : (
                    ["Product", "Category", "Brand", "Price", "Stock", "Actions"].map((header) => (
                      <th key={header} className="p-3 font-semibold">
                        {header}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "categories" ? filteredCategories : filteredProducts).map((entity) => {
                  const entityId = entity.id || entity._id || entity.sku || entity.name;
                  const isExpanded = activeTab === "products" && expandedProductId === entityId;

                  if (activeTab === "categories") {
                    return (
                      <tr key={entityId} className="border-t border-gray-200">
                        <td className="p-3 text-gray-700">{formatDisplayValue(entity.name)}</td>
                        <td className="p-3 text-gray-700">{formatDisplayValue(entity.description)}</td>
                        <td className="p-3">
                          <div className="flex justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleCategoryEdit(entity)}
                              className="text-blue-600"
                              aria-label="Edit record"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCategoryDelete(entity)}
                              className="text-red-600"
                              aria-label="Delete record"
                            >
                              <Trash size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const detailCards = [
                    { label: "SKU", value: entity.sku },
                    { label: "Barcode", value: entity.barcode },
                    { label: "Sale Price", value: entity.salePrice },
                    { label: "Low Stock Threshold", value: entity.lowStockThreshold },
                    { label: "Image URL", value: entity.image, wide: true },
                    { label: "Description", value: entity.description, wide: true },
                  ];

                  return (
                    <React.Fragment key={entityId}>
                      <tr className="border-t border-gray-200 align-top transition hover:bg-gray-50">
                        <td className="p-3 text-gray-800">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setExpandedProductId(isExpanded ? null : entityId)}
                              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
                                isExpanded
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-700"
                              }`}
                              aria-label={isExpanded ? "Collapse product details" : "Expand product details"}
                            >
                              {isExpanded ? <Minus size={15} /> : <Plus size={15} />}
                            </button>
                            <span className="block min-w-0 truncate font-medium">{formatDisplayValue(entity.name)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-gray-700">
                          <span className="block truncate">{getCategoryName(entity.categoryId)}</span>
                        </td>
                        <td className="p-3 text-gray-700">
                          <span className="block truncate">{formatDisplayValue(entity.brand)}</span>
                        </td>
                        <td className="p-3 text-gray-700">{formatDisplayValue(entity.price)}</td>
                        <td className={`p-3 ${isLowStock(entity) ? "font-semibold text-amber-700" : "text-gray-700"}`}>
                          {formatDisplayValue(entity.stockQuantity)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleProductEdit(entity)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-100 text-blue-600 transition hover:bg-blue-50"
                              aria-label="Edit record"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleProductDelete(entity)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-100 text-red-600 transition hover:bg-red-50"
                              aria-label="Delete record"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td colSpan={6} className="p-0">
                          <div
                            className={`grid transition-all duration-300 ease-in-out ${
                              isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="m-3 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-inner">
                                <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge value={entity.isActive ? "Active" : "Inactive"} />
                                    {isLowStock(entity) && (
                                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                        Low stock
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                  {detailCards.map((item) => (
                                    <div
                                      key={item.label}
                                      className={`rounded-md border border-gray-200 bg-white p-3 ${
                                        item.wide ? "sm:col-span-2" : ""
                                      }`}
                                    >
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                                      <p className="mt-1 break-words text-sm leading-6 text-gray-800">
                                        {formatDisplayValue(item.value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {((activeTab === "categories" ? filteredCategories : filteredProducts).length === 0) && (
                  <tr>
                    <td colSpan={activeTab === "categories" ? 3 : 6} className="p-6 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {activeTab === "products" && (
            <div className="hidden items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600 md:flex">
              <span>
                Showing {filteredProducts.length ? 1 : 0} to {filteredProducts.length} of {filteredProducts.length} results
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md px-2 py-1 text-gray-400" aria-label="Previous page">
                  <ChevronLeft size={17} />
                </button>
                <span className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">1</span>
                <button type="button" className="rounded-md px-2 py-1 text-gray-400" aria-label="Next page">
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3 p-4 md:hidden">
            {(activeTab === "categories" ? filteredCategories : filteredProducts).map((entity) => {
              const entityId = entity.id || entity._id || entity.sku || entity.name;
              const isExpanded = activeTab === "products" && expandedProductId === entityId;
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
              const detailFields = [
                { label: "SKU", value: entity.sku },
                { label: "Barcode", value: entity.barcode },
                { label: "Sale Price", value: entity.salePrice },
                { label: "Low Stock Threshold", value: entity.lowStockThreshold },
                { label: "Image URL", value: entity.image },
                { label: "Description", value: entity.description },
                { label: "Active Status", value: entity.isActive ? "Active" : "Inactive" },
              ];

              return (
                <div key={entityId} className="rounded-lg border border-gray-200 p-3">
                  <div className="space-y-3">
                    {summaryFields.map((item) => (
                      <div key={item.label} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
                        <span className="font-medium text-gray-500">{item.label}</span>
                        {activeTab === "products" && item.label === "Product" ? (
                          <span className="flex min-w-0 items-center gap-2 text-gray-800">
                            <button
                              type="button"
                              onClick={() => setExpandedProductId(isExpanded ? null : entityId)}
                              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
                                isExpanded
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-gray-200 text-gray-600"
                              }`}
                              aria-label={isExpanded ? "Collapse product details" : "Expand product details"}
                            >
                              {isExpanded ? <Minus size={15} /> : <Plus size={15} />}
                            </button>
                            <span className="min-w-0 break-words">{formatDisplayValue(item.value)}</span>
                          </span>
                        ) : (
                          <span className="min-w-0 break-words text-gray-800">{formatDisplayValue(item.value)}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {activeTab === "products" && (
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-inner">
                          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
                            <StatusBadge value={entity.isActive ? "Active" : "Inactive"} />
                            {isLowStock(entity) && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                Low stock
                              </span>
                            )}
                          </div>
                          <div className="grid gap-2">
                            {detailFields.map((item) => (
                              <div key={item.label} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</span>
                                <span className="mt-1 block min-w-0 break-words text-gray-800">{formatDisplayValue(item.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

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
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700"
                    >
                      <Edit size={16} />
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
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
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
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
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
      </section>

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
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
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
                      <td key={field.name} className="p-3 text-gray-700">
                        {field.name === "status" || field.name === "apiAccess" ? (
                          <StatusBadge value={record[field.name]} />
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
                          className="text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Edit record"
                        >
                          <Edit size={18} />
                        </button>
              <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          disabled={!canDelete}
                          className="text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Delete record"
                        >
                          <Trash size={18} />
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
                          <StatusBadge value={record[field.name]} />
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
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(record.id)}
                    disabled={!canDelete}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
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
