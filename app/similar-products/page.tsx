'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import { PlusIcon } from '@/components/Icons'

interface SimilarProduct {
  id: string
  productCode: string
  device: string
  regulationDescription: string
  medicalSpecialty: string
  fdaClassificationLink?: string
}

function SimilarProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())

  const productName = searchParams.get('productName') || ''
  const intendedUse = searchParams.get('intendedUse') || ''

  // Mock similar products data
  const similarProducts: SimilarProduct[] = [
    {
      id: '1',
      productCode: 'FMF',
      device: 'Syringe, Piston',
      regulationDescription: 'Syringe, Piston',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '2',
      productCode: 'MEG',
      device: 'Syringe, Antistick',
      regulationDescription: 'Syringe, Antistick',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '3',
      productCode: 'FRN',
      device: 'Pump, Infusion',
      regulationDescription: 'Pump, Infusion',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
    },
    {
      id: '4',
      productCode: 'DXT',
      device: 'Injector And Syringe, Angiographic',
      regulationDescription: 'Injector And Syringe, Angiographic',
      medicalSpecialty: 'Cardiovascular',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=870.1200'
    },
    {
      id: '5',
      productCode: 'GAA',
      device: 'Syringe, Disposable',
      regulationDescription: 'Syringe, Disposable',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '6',
      productCode: 'KGL',
      device: 'Syringe, Glass',
      regulationDescription: 'Syringe, Glass',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '7',
      productCode: 'MMM',
      device: 'Pump, Infusion, Insulin',
      regulationDescription: 'Pump, Infusion, Insulin',
      medicalSpecialty: 'Endocrinology',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
    },
    {
      id: '8',
      productCode: 'NYY',
      device: 'Syringe, Tubing',
      regulationDescription: 'Syringe, Tubing',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '9',
      productCode: 'OZS',
      device: 'Pump, Infusion, Enteral',
      regulationDescription: 'Pump, Infusion, Enteral',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
    },
    {
      id: '10',
      productCode: 'PQR',
      device: 'Injector, Pressure, Angiographic',
      regulationDescription: 'Injector, Pressure, Angiographic',
      medicalSpecialty: 'Cardiovascular',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=870.1200'
    },
    {
      id: '11',
      productCode: 'STU',
      device: 'Syringe, Plastic',
      regulationDescription: 'Syringe, Plastic',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '12',
      productCode: 'VWX',
      device: 'Pump, Syringe',
      regulationDescription: 'Pump, Syringe',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
    },
    {
      id: '13',
      productCode: 'YZA',
      device: 'Injector, Hypodermic, Single Use',
      regulationDescription: 'Injector, Hypodermic, Single Use',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '14',
      productCode: 'BCD',
      device: 'Syringe, Prefilled',
      regulationDescription: 'Syringe, Prefilled',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '15',
      productCode: 'EFG',
      device: 'Pump, Infusion, Elastomeric',
      regulationDescription: 'Pump, Infusion, Elastomeric',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
    },
    {
      id: '16',
      productCode: 'HIJ',
      device: 'Syringe, Safety',
      regulationDescription: 'Syringe, Safety',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '17',
      productCode: 'KLM',
      device: 'Injector, Jet, Needle Free',
      regulationDescription: 'Injector, Jet, Needle Free',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '18',
      productCode: 'NOP',
      device: 'Pump, Infusion, Patient Controlled',
      regulationDescription: 'Pump, Infusion, Patient Controlled',
      medicalSpecialty: 'Anesthesiology',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
    },
    {
      id: '19',
      productCode: 'QRS',
      device: 'Syringe, Sterile',
      regulationDescription: 'Syringe, Sterile',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    }
  ]

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleCancel = () => {
    router.push('/generate')
  }

  const handleAddProducts = () => {
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }

    // Navigate to results page with selected products
    const selectedProductCodes = Array.from(selectedProducts)
      .map(id => {
        const product = similarProducts.find(p => p.id === id)
        return product?.productCode
      })
      .filter(Boolean)
      .join(',')

    const useParam = intendedUse.trim() ? `&intendedUse=${encodeURIComponent(intendedUse)}` : ''
    const selectedParam = `&selectedProducts=${encodeURIComponent(selectedProductCodes)}`
    router.push(`/results?productName=${encodeURIComponent(productName)}${useParam}${selectedParam}`)
  }

  return (
    <main className={styles.main}>
      <div className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>Cira Health</Link>
          <div className={styles.navActions}>
            <button 
              className={styles.enterpriseButton}
              onClick={() => {}}
            >
              Go to Enterprise Version
            </button>
            <button 
              className={styles.loginButton}
              onClick={() => router.push('/login')}
            >
              Login / Sign Up
            </button>
          </div>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Found {similarProducts.length} Similar Products</h1>
          <div className={styles.tabContainer}>
            <div className={styles.tab}>
              FDA 510k Database ({similarProducts.length})
            </div>
          </div>
          <p className={styles.guidance}>
            In order to ensure the relevancy, please pick the product code that's most similar to the product you picked.
          </p>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>SELECT</th>
                <th className={styles.th}>PRODUCT CODE</th>
                <th className={styles.th}>DEVICE</th>
                <th className={styles.th}>REGULATION DESCRIPTION</th>
                <th className={styles.th}>MEDICAL SPECIALTY</th>
              </tr>
            </thead>
            <tbody>
              {similarProducts.map((product) => (
                <tr key={product.id} className={styles.tr}>
                  <td className={styles.td}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => handleToggleProduct(product.id)}
                      className={styles.checkbox}
                    />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.productCodeCell}>
                      <span className={styles.productCode}>{product.productCode}</span>
                      {product.fdaClassificationLink && (
                        <a
                          href={product.fdaClassificationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fdaLink}
                        >
                          View FDA Classification →
                        </a>
                      )}
                    </div>
                  </td>
                  <td className={styles.td}>{product.device}</td>
                  <td className={styles.td}>{product.regulationDescription}</td>
                  <td className={styles.td}>{product.medicalSpecialty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={handleCancel}>
            Cancel
          </button>
          <button className={styles.addButton} onClick={handleAddProducts}>
            <PlusIcon className={styles.plusIcon} />
            Add Selected Products
          </button>
        </div>
      </div>
    </main>
  )
}

export default function SimilarProductsPage() {
  return (
    <Suspense fallback={<div className={styles.main}>Loading...</div>}>
      <SimilarProductsContent />
    </Suspense>
  )
}
