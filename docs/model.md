# User
fields:
   id: string
   clerkId: string
   firstName: string
   lastName: string
   imageUrl: string
   email: string
   phoneNumber: string
   role: string
   position: string
   gender: string
   idNumber: string
   taxNumber: string
   dob: timestamp
   idType: string
   createdAt: timestamp
   updatedAt: timestamp

# Personal Documents
fields:
    id: string
    userId: string
    docType: string
    docUrl: string
    createdAt: timestamp
    updatedAt: timestamp


# Business Profile
    id: string
    userId: string
    name: string
    description: string
    imageUrl: string
    coverImage: string
    entityType: string
    country: string
    city: string
    address: string
    zipCode: string
    address2: string
    sector: string
    yearOfIncorporation: string
    avgMonthlyTurnover: number
    avgYearlyTurnover: number
    borrowingHistory: boolean
    amountBorrowed: number
    loanStatus: string
    defaultReason: string
    currency: string
    ownershipType: string
    ownershipPercentage: number
    isOwned: boolean
    createdAt: timestamp
    updatedAt: timestamp

# Business Documents
fields: 
     id: string
     businessId: string
     docType: string
     docUrl: string
     docPassword: string
     docBankName: string
     createdAt: timestamp
     updatedAt: timestamp
