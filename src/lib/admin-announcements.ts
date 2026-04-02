export type {
  AdminSiteDocumentInput as AdminAnnouncementInput,
  AdminSiteDocumentItem as AdminAnnouncementItem,
} from "@/lib/admin-site-documents"

export {
  getAdminSiteDocumentList as getAdminAnnouncementList,
  removeAdminSiteDocument as removeAdminAnnouncement,
  saveAdminSiteDocument as saveAdminAnnouncement,
  toggleAdminSiteDocumentPin as toggleAdminAnnouncementPin,
  updateAdminSiteDocumentStatus as updateAdminAnnouncementStatus,
} from "@/lib/admin-site-documents"
